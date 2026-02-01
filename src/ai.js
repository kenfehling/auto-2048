import { Game } from './game.js';
import { StrategyDSL } from './strategy-dsl.js';

export class AI {
  constructor(strategyText = null) {
    this.transpositionTable = new Map();

    // Load strategy from DSL
    if (strategyText) {
      this.loadStrategy(strategyText);
    } else {
      // Use default hardcoded snake strategy
      this.loadFallbackStrategy();
    }
  }

  loadStrategy(strategyText) {
    this.strategy = new StrategyDSL(strategyText);
    const searchConfig = this.strategy.getSearchConfig();
    const movesConfig = this.strategy.getMovesConfig();

    // Extract configuration (maxTime will be set dynamically by worker based on speed)
    this.maxTime = 80; // Default, will be overridden
    this.maxDepth = searchConfig.maxDepth;
    this.pruningStrategy = searchConfig.pruning;
    this.fallbackOrder = movesConfig.fallbackOrder;

    // Create evaluator function from DSL
    this.evaluator = this.strategy.createEvaluator();
    
    // Log for debugging
    if (typeof window !== 'undefined') {
      console.log('✅ AI: Loaded DSL strategy with', this.strategy.config.components.length, 'components');
    }
  }

  loadFallbackStrategy() {
    // Hardcoded fallback if DSL fails to load
    this.maxTime = 80;
    this.maxDepth = 8;
    this.pruningStrategy = 'top_3_cells';
    this.fallbackOrder = [0, 3, 1, 2];
    this.evaluator = null; // Will use legacy evaluate method
    
    // Log for debugging
    if (typeof window !== 'undefined') {
      console.log('⚠️ AI: Using hardcoded fallback strategy');
    }
  }

  getNextMove(game) {
    this.transpositionTable.clear();
    const startTime = Date.now();
    let bestMove = -1;
    let depth = 1;

    // Iterative Deepening with configurable time limit
    while (Date.now() - startTime < this.maxTime) {
      const result = this.expectimax(game, depth, true);
      if (result.move !== -1) {
        bestMove = result.move;
      }
      depth++;
      if (depth > this.maxDepth) break;
    }

    // Safety move if logic fails (rare)
    if (bestMove === -1) {
      for (let dir of this.fallbackOrder) {
        const sim = Game.fromState(game.serialize());
        if (sim.move(dir, true)) return dir;
      }
    }

    // Debug: log move decision info on first move
    if (typeof window !== 'undefined' && window.logMoves !== false && !window.moveLogged) {
      window.moveLogged = true;
      const evals = [0,1,2,3].map(m => {
        const sim = Game.fromState(game.serialize());
        if (!sim.move(m, true)) return null;
        return this.evaluate(sim);
      }).filter(x => x !== null);
      console.log('🎮 First move:', bestMove, 'Scores:', evals.map(s => s.toExponential(2)));
    }

    return bestMove;
  }

  hashGrid(grid) {
    let hash = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        hash += (grid[r][c] ? grid[r][c].value : 0) + ",";
      }
    }
    return hash;
  }

  expectimax(game, depth, isPlayerTurn) {
    game.isSimulating = true;
    const hash = this.hashGrid(game.grid) + "|" + depth + "|" + isPlayerTurn;
    if (this.transpositionTable.has(hash)) return this.transpositionTable.get(hash);

    if (depth === 0 || game.over) {
      return { score: this.evaluate(game) };
    }

    let result;
    if (isPlayerTurn) {
      let maxScore = -Infinity;
      let bestMove = -1;
      let moved = false;

      for (let move of [0, 1, 2, 3]) {
        const sim = Game.fromState(game.serialize());
        if (sim.move(move, true)) {
          moved = true;
          const res = this.expectimax(sim, depth - 1, false);
          if (res.score > maxScore) {
            maxScore = res.score;
            bestMove = move;
          }
        }
      }
      result = moved ? { score: maxScore, move: bestMove } : { score: -1e25 };
    } else {
      let totalScore = 0;
      let count = 0;
      const empty = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!game.grid[r][c]) empty.push({ r, c });

      if (empty.length === 0) return { score: this.evaluate(game) };

      // Configurable pruning strategy
      let sampled = empty;
      if (this.pruningStrategy === 'top_3_cells' && empty.length > 3) {
        sampled = empty.slice(0, 3);
      }

      for (const cell of sampled) {
        const sim2 = Game.fromState(game.serialize());
        sim2.grid[cell.r][cell.c] = { value: 2 };
        totalScore += 0.9 * this.expectimax(sim2, depth - 1, true).score;

        const sim4 = Game.fromState(game.serialize());
        sim4.grid[cell.r][cell.c] = { value: 4 };
        totalScore += 0.1 * this.expectimax(sim4, depth - 1, true).score;
        count++;
      }
      result = { score: totalScore / count };
    }

    this.transpositionTable.set(hash, result);
    return result;
  }

  evaluate(game) {
    // Use DSL-based evaluator if available
    if (this.evaluator) {
      // Ensure we don't log during sim unless explicitly requested
      if (game.isSimulating === undefined) game.isSimulating = true;
      return this.evaluator(game);
    }

    // Legacy fallback evaluation
    if (typeof window !== 'undefined' && window.logEvalPath) {
      console.log('⚠️ Using hardcoded evaluate path');
    }
    return this.legacyEvaluate(game);
  }

  legacyEvaluate(game) {
    if (game.over && !game.movesAvailable()) return -1e30;

    const grid = game.grid;
    let score = 0;
    const path = [
      [0, 0], [0, 1], [0, 2], [0, 3],
      [1, 3], [1, 2], [1, 1], [1, 0],
      [2, 0], [2, 1], [2, 2], [2, 3],
      [3, 3], [3, 2], [3, 1], [3, 0]
    ];

    let lastVal = Infinity;
    let monotonicityPenalty = 0;

    for (let i = 0; i < path.length; i++) {
      const [r, c] = path[i];
      const tile = grid[r][c];
      const val = tile ? tile.value : 0;

      if (val > 0) {
        score += Math.pow(val, 2) * Math.pow(10, 15 - i);

        if (val > lastVal) {
          monotonicityPenalty += (val - lastVal) * Math.pow(10, 16 - i);
        }
        lastVal = val;
      } else {
        lastVal = 0;
      }
    }

    const emptyCount = grid.flat().filter(c => c === null).length;

    let smoothness = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c]) {
          const val = grid[r][c].value;
          if (c < 3 && grid[r][c + 1]) smoothness -= Math.abs(val - grid[r][c + 1].value);
          if (r < 3 && grid[r + 1][c]) smoothness -= Math.abs(val - grid[r + 1][c].value);
        }
      }
    }

    return score - monotonicityPenalty + (emptyCount * 1e12) + (smoothness * 1e4);
  }
}
