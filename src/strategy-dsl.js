/**
 * Strategy DSL Parser and Interpreter for 2048 AI
 * 
 * Flexible component-based DSL that supports arbitrary evaluation strategies.
 */

export class StrategyDSL {
  constructor(dslText) {
    this.dslText = dslText;
    this.config = this.parse(dslText);
  }

  parse(text) {
    const config = {
      search: {},
      components: [],
      moves: {}
    };

    // Parse SEARCH block
    const searchMatch = text.match(/SEARCH\s*\{([^}]+)\}/s);
    if (searchMatch) {
      config.search = this.parseSimpleBlock(searchMatch[1]);
    }

    // Parse COMPONENT blocks (can have multiple)
    const componentRegex = /COMPONENT\s+(\w+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;
    let match;
    while ((match = componentRegex.exec(text)) !== null) {
      const [, name, content] = match;
      config.components.push({
        name,
        config: this.parseComponentBlock(content)
      });
    }

    // Parse MOVES block
    const movesMatch = text.match(/MOVES\s*\{([^}]+)\}/s);
    if (movesMatch) {
      config.moves = this.parseSimpleBlock(movesMatch[1]);
    }

    return config;
  }

  parseSimpleBlock(blockText) {
    const result = {};
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (key && value) {
        result[key] = this.parseValue(value);
      }
    }

    return result;
  }

  parseComponentBlock(blockText) {
    const result = {};

    // First, extract any nested blocks
    const nestedBlockRegex = /(\w+)\s*\{([^}]+)\}/g;
    const nestedBlocks = [];
    let nestedMatch;

    while ((nestedMatch = nestedBlockRegex.exec(blockText)) !== null) {
      const [fullMatch, name, content] = nestedMatch;
      nestedBlocks.push({ fullMatch, name, content, index: nestedMatch.index });
    }

    // Remove nested blocks from text temporarily
    let remainingText = blockText;
    for (let i = nestedBlocks.length - 1; i >= 0; i--) {
      const block = nestedBlocks[i];
      remainingText = remainingText.substring(0, block.index) +
        remainingText.substring(block.index + block.fullMatch.length);
    }

    // Parse simple key-value pairs
    const lines = remainingText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (key && value) {
        result[key] = this.parseValue(value);
      }
    }

    // Add nested blocks
    for (const block of nestedBlocks) {
      result[block.name] = this.parseSimpleBlock(block.content);
    }

    return result;
  }

  parseValue(value) {
    value = value.replace(/[,;]$/, '');

    if (value.endsWith('ms')) {
      return parseInt(value);
    }

    if (value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('Failed to parse array:', value);
        return value;
      }
    }

    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value)) {
      return parseFloat(value);
    }

    return value.replace(/['"]/g, '');
  }

  evaluateExpression(expr, vars) {
    if (typeof expr !== 'string') return expr;

    expr = expr.replace(/\^/g, '**');

    for (const [key, value] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
    }

    const abs = Math.abs;
    const max = Math.max;
    const min = Math.min;
    const log2 = Math.log2;
    const sqrt = Math.sqrt;

    try {
      // eslint-disable-next-line no-eval
      return eval(expr);
    } catch (e) {
      console.error('Error evaluating expression:', expr, e);
      return 0;
    }
  }

  getSearchConfig() {
    return {
      maxTime: this.config.search.max_time || 80,
      maxDepth: this.config.search.max_depth || 8,
      pruning: this.config.search.pruning || 'top_3_cells'
    };
  }

  getMovesConfig() {
    return {
      fallbackOrder: this.config.moves.fallback_order || [0, 3, 1, 2]
    };
  }

  createEvaluator() {
    const components = this.config.components;

    return (game) => {
      const grid = game.grid;
      let totalScore = 0;

      if (game.over && !game.movesAvailable()) {
        return -1e30;
      }

      for (const component of components) {
        const score = this.executeComponent(component, game, grid);
        totalScore += score;
      }

      return totalScore;
    };
  }

  executeComponent(component, game, grid) {
    const { name, config } = component;
    let score = 0;

    if (name === 'position_weights') {
      const weights = config.weights;
      const formula = config.formula;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const tile = grid[r][c];
          if (tile) {
            const weight = weights[r][c];
            const value = tile.value;
            score += this.evaluateExpression(formula, { value, weight });
          }
        }
      }
    }

    else if (name === 'monotonic_path') {
      const path = config.path;
      const position_score = config.position_score;
      const break_penalty = config.break_penalty;

      let lastVal = Infinity;
      for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const tile = grid[r][c];
        const value = tile ? tile.value : 0;

        if (value > 0) {
          if (position_score) {
            score += this.evaluateExpression(position_score, { value, index: i });
          }

          if (value > lastVal && break_penalty) {
            score -= this.evaluateExpression(break_penalty, {
              value_diff: value - lastVal,
              index: i
            });
          }
          lastVal = value;
        } else {
          lastVal = 0;
        }
      }
    }

    else if (name === 'empty_cells') {
      const count = grid.flat().filter(c => c === null).length;
      const formula = config.formula;
      score += this.evaluateExpression(formula, { count });
    }

    else if (name === 'merge_potential') {
      const formula = config.formula;
      let mergeScore = 0;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c]) {
            const val = grid[r][c].value;
            let matches = 0;

            if (c < 3 && grid[r][c + 1] && grid[r][c + 1].value === val) matches++;
            if (r < 3 && grid[r + 1][c] && grid[r + 1][c].value === val) matches++;

            if (matches > 0) {
              mergeScore += this.evaluateExpression(formula, { value: val, matches });
            }
          }
        }
      }
      score += mergeScore;
    }

    else if (name === 'smoothness') {
      const formula = config.formula;
      let smoothness = 0;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c]) {
            const val = grid[r][c].value;
            if (c < 3 && grid[r][c + 1]) {
              smoothness -= Math.abs(val - grid[r][c + 1].value);
            }
            if (r < 3 && grid[r + 1][c]) {
              smoothness -= Math.abs(val - grid[r + 1][c].value);
            }
          }
        }
      }
      score += this.evaluateExpression(formula, { smoothness });
    }

    else if (name === 'max_tile') {
      const formula = config.formula;
      let maxVal = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c] && grid[r][c].value > maxVal) {
            maxVal = grid[r][c].value;
          }
        }
      }
      score += this.evaluateExpression(formula, { max_value: maxVal });
    }

    else if (name === 'corner_bonus') {
      const formula = config.formula;
      const corners = [[0, 0], [0, 3], [3, 0], [3, 3]];

      for (const [r, c] of corners) {
        if (grid[r][c]) {
          const value = grid[r][c].value;
          score += this.evaluateExpression(formula, { value });
        }
      }
    }

    return score;
  }
}
