import { Game } from './game.js';

export class AI {
  constructor() {
    this.transpositionTable = new Map();
    // Snake path mapping for easy traversal
    this.path = [
      [0, 0], [0, 1], [0, 2], [0, 3],
      [1, 3], [1, 2], [1, 1], [1, 0],
      [2, 0], [2, 1], [2, 2], [2, 3],
      [3, 3], [3, 2], [3, 1], [3, 0]
    ];
  }

  getNextMove(game) {
    this.transpositionTable.clear();
    const startTime = Date.now();
    let bestMove = -1;
    let depth = 1;
    const emptyCount = game.grid.flat().filter(c => c === null).length;
    // Smooth linear mapping: Depth 6 when empty=16, up to Depth 14 when empty=0
    const maxDepth = Math.round(14 - (emptyCount * 0.5));

    // Iterative Deepening within 80ms to keep animations perfectly smooth
    while (Date.now() - startTime < 80) {
      const result = this.expectimax(game, depth, true);
      if (result.move !== -1) {
        bestMove = result.move;
      }
      depth++;
      if (depth > maxDepth) break;
    }

    // Safety move if logic fails (rare)
    if (bestMove === -1) {
      for (let dir of [0, 3, 1, 2]) { // Order matters for forced moves
        const sim = Game.fromState(game.serialize());
        if (sim.move(dir, true)) return dir;
      }
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
    const hash = this.hashGrid(game.grid) + depth + isPlayerTurn;
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

      // Pruning: only check the most critical spaces at high depth
      const sampled = empty.length > 3 ? empty.slice(0, 3) : empty;

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
    if (game.over && !game.movesAvailable()) return -1e30;

    const grid = game.grid;
    let score = 0;

    // 1. Strict Snake Pattern Weighting
    // We use a massive base (10) for position weights to make the sequence the dominant factor.
    // Order: [0,0] -> [0,1] -> [0,2] -> [0,3] -> [1,3] -> [1,2] ...
    let lastVal = Infinity;
    let monotonicityPenalty = 0;

    for (let i = 0; i < this.path.length; i++) {
      const [r, c] = this.path[i];
      const tile = grid[r][c];
      const val = tile ? tile.value : 0;

      if (val > 0) {
        // Position Weight: earlier in path = exponentially higher reward
        // This ensures 2048 in [0,0] is worth VASTLY more than 2048 anywhere else.
        score += Math.pow(val, 2) * Math.pow(10, 15 - i);

        // Penalty for sequence disruption
        if (val > lastVal) {
          monotonicityPenalty += (val - lastVal) * Math.pow(10, 16 - i);
        }
        lastVal = val;
      } else {
        // Blank tiles should ideally be at the end of the snake
        lastVal = 0;
      }
    }

    // 2. Free Space (to keep the board alive)
    const emptyCount = grid.flat().filter(c => c === null).length;

    // 3. Smoothness (neighboring tiles similarity)
    let smoothness = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c]) {
          const val = grid[r][c].value;
          // Only check neighbors to reward merging potential
          if (c < 3 && grid[r][c + 1]) smoothness -= Math.abs(val - grid[r][c + 1].value);
          if (r < 3 && grid[r + 1][c]) smoothness -= Math.abs(val - grid[r + 1][c].value);
        }
      }
    }

    // Final Score: Snake priority is king.
    // One broken sequence link should be more expensive than any number of free spaces.
    return score - monotonicityPenalty + (emptyCount * 1e12) + (smoothness * 1e4);
  }
}
