# Strategy Implementation Guide

## Overview

The 2048 AI strategies are implemented using a flexible **Domain-Specific Language (DSL)** that allows defining evaluation strategies without hardcoding logic. Each strategy file is loaded and parsed to create a board evaluation function.

## API Contract

### Strategy File Format

A strategy DSL file must have this structure:

```
SEARCH {
  max_time: <milliseconds>
  max_depth: <integer>
  pruning: <pruning_strategy>
}

COMPONENT <name> {
  <configuration>
}

[... more COMPONENT blocks ...]

MOVES {
  fallback_order: [<direction>, ...]
}
```

### SEARCH Block (Required)

Configures the minimax search parameters:

- `max_time`: Maximum milliseconds to spend searching (80ms is typical)
- `max_depth`: Maximum search depth with iterative deepening (8 is standard)
- `pruning`: Only `top_3_cells` is currently supported

### COMPONENT Blocks (Required: At Least One)

Each component scores the board based on different criteria. Components are **independent** and their scores are **summed**.

#### Available Component Types

**1. `monotonic_path`** - Enforces tile ordering along a path

```
COMPONENT monotonic_path {
  path: [[0,0], [0,1], [0,2], ...]  // 16 cells, any order
  position_score: value^2 * 10^(15-index)
  break_penalty: value_diff * 10^(16-index)
}
```

**Variables available in formulas:**
- `value`: Tile value at this path position
- `index`: Position index (0-15)
- `value_diff`: How much the monotonic order is broken

**Best for:** Classic snake strategy where you want tiles arranged in descending order

---

**2. `position_weights`** - Scores tiles based on a 4x4 weight grid

```
COMPONENT position_weights {
  weights: [
    [100, 50, 20, 10],
    [50, 10, 5, 2],
    [20, 5, 2, 1],
    [10, 2, 1, 0.5]
  ]
  formula: value^2 * weight * 1e10
}
```

**Variables available in formulas:**
- `value`: Tile value
- `weight`: Weight from grid at that position

**Best for:** Position-based strategies where certain areas are more valuable

---

**3. `empty_cells`** - Rewards having empty cells on the board

```
COMPONENT empty_cells {
  formula: count * 1e12
}
```

**Variables available in formulas:**
- `count`: Number of empty cells

**Best for:** Keeping the board open; nearly all strategies should include this

---

**4. `smoothness`** - Penalizes large differences between neighbors

```
COMPONENT smoothness {
  formula: smoothness * 1e4
}
```

**Variables available in formulas:**
- `smoothness`: Negative sum of absolute differences between neighbors (pre-calculated)

**Best for:** Encouraging mergeable neighbors

---

**5. `max_tile`** - Rewards the maximum tile value on board

```
COMPONENT max_tile {
  formula: max_value^2 * 1e8
}
```

**Variables available in formulas:**
- `max_value`: The highest tile value currently on board

**Best for:** Encouraging progress toward 2048 or higher

---

**6. `merge_potential`** - Rewards tiles with matching neighbors

```
COMPONENT merge_potential {
  formula: value * matches * 1e10
}
```

**Variables available in formulas:**
- `value`: Tile value
- `matches`: Number of adjacent tiles with same value (0, 1, or 2)

**Best for:** Encouraging strategic merging

---

**7. `corner_bonus`** - Rewards high-value tiles in corners

```
COMPONENT corner_bonus {
  formula: value^2 * 1e9
}
```

**Variables available in formulas:**
- `value`: Tile value

**Corners:** [0,0], [0,3], [3,0], [3,3]

**Best for:** Keeping large tiles in safe positions

---

### MOVES Block (Optional)

```
MOVES {
  fallback_order: [0, 3, 1, 2]
}
```

Direction mapping:
- `0` = UP
- `1` = RIGHT  
- `2` = DOWN
- `3` = LEFT

Used as a tiebreaker when multiple moves have equal score, and for safety fallback if AI fails.

## Formula Expressions

All formula expressions support:

- **Arithmetic:** `+`, `-`, `*`, `/`, `^` (power)
- **Functions:** `abs()`, `max()`, `min()`, `log2()`, `sqrt()`
- **Numbers:** Integers, decimals, and scientific notation (`1e10`, `5e3`)

Example expressions:
```
value^2 * 10^(15-index)
value * log2(value) * 1e9
sqrt(count) * 1e12
max(value - weight, 0) * 1e8
```

## Key Principles for Effective Strategies

### 1. **Balance is Critical**

The scores from components are summed, so their magnitudes must be comparable. If one component is 1e21 and another is 1e3, the smaller one is effectively ignored.

Example:
```
COMPONENT position_weights {
  formula: value^2 * weight * 1e10  // Max ~2048^2 * 100 * 1e10 = 4.2e19
}

COMPONENT empty_cells {
  formula: count * 1e12  // Max ~16 * 1e12 = 1.6e13
}
// These scales are incomparable! Position dominates.
```

**Solution:** Match magnitudes by using appropriate multipliers
```
formula: value^2 * weight * 1e9   // Now ~4.2e18
formula: count * 1e13             // Now ~1.6e14
// Still off by 10,000x but better
```

### 2. **Positional Weight Matters Most**

The strongest component typically scores based on tile positions/values, since these drive the search tree most effectively.

**Strong:** `10^(15-index)` scaling (values from 1e0 to 1e15)
**Weak:** `weight * 1e10` scaling (max ~100 * 1e10 = 1e12)

### 3. **Empty Cells = Board Survival**

Nearly every strategy needs `empty_cells`. Without it, the AI boxes itself in.

Typical weight: `count * 1e12` to `count * 5e12`

### 4. **Smoothness is a Tie-Breaker**

Smoothness has relatively small magnitude and mostly acts as a tiebreaker when other metrics are equal. Use `1e3` to `1e4` multiplier.

### 5. **Test with Real Games**

Parse correctness and unit tests aren't enough. Run the actual game and track:
- Can it consistently reach 2048?
- How often does it reach 4096?
- Does it get stuck easily?

## Common Mistakes

❌ **Mistake 1:** Using the same multiplier for all components
```
COMPONENT position_weights {
  formula: value^2 * weight * 1e10
}
COMPONENT empty_cells {
  formula: count * 1e10  // Too weak!
}
```

❌ **Mistake 2:** Formula references undefined variables
```
COMPONENT monotonic_path {
  path: [[0,0], ...]
  break_penalty: (value - lastVal) * 1e10  // lastVal not defined!
}
```

❌ **Mistake 3:** Poorly calibrated path scoring
```
path: [[0,0], ...]
position_score: value^2 * 10^(5-index)  // Drops to 1e0 by end
```

## Debugging

### Check if strategy loads
```javascript
import { StrategyDSL } from './src/strategy-dsl.js';
const dsl = new StrategyDSL(strategyText);
console.log(dsl.config.components.map(c => c.name));
```

### Compare scores
```javascript
const evaluator = dsl.createEvaluator();
const score1 = evaluator(game1);
const score2 = evaluator(game2);
console.log(`Score 1: ${score1.toExponential(2)}`);
console.log(`Score 2: ${score2.toExponential(2)}`);
```

### Verify component is working
Edit the component formula to something diagnostic:
```
formula: value^2 * 1e20  // Make it massive to see its effect
```

If the score changes drastically, the component is being evaluated.

## Example: Custom Strategy

Here's a balanced custom strategy emphasizing merge potential:

```
SEARCH {
  max_time: 80ms
  max_depth: 8
  pruning: top_3_cells
}

// Reward merging neighboring tiles
COMPONENT merge_potential {
  formula: value * matches * 1e11
}

// Reward empty spaces
COMPONENT empty_cells {
  formula: count * 1e13
}

// Bonus for having large tiles in corners
COMPONENT corner_bonus {
  formula: value^2 * 1e10
}

// Encourage merging nearby values
COMPONENT smoothness {
  formula: smoothness * 1e4
}

MOVES {
  fallback_order: [0, 1, 2, 3]
}
```
