# 2048 AI Strategy DSL

A flexible, component-based Domain-Specific Language for defining 2048 AI strategies.

## Philosophy

The DSL is designed to support **drastically different strategies** through composable evaluation components. Unlike hardcoded approaches, you can mix and match components to create entirely new playstyles.

## Core Concepts

### Components
Evaluation components are the building blocks of a strategy. Each component scores the board based on different criteria. Components are **independent** and **composable** - you can use any combination.

### Available Components

#### `monotonic_path`
Enforces a specific ordering of tiles along a path (like the "snake" strategy).

```
COMPONENT monotonic_path {
  path: [[0,0], [0,1], [0,2], ...]
  position_score: value^2 * 10^(15-index)
  break_penalty: value_diff * 10^(16-index)
}
```

- `path`: Array of [row, col] coordinates
- `position_score`: Formula for scoring tiles (vars: `value`, `index`)
- `break_penalty`: Penalty when order is broken (vars: `value_diff`, `index`)

#### `position_weights`
Scores tiles based on a 2D weight grid (no path required).

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

- `weights`: 4x4 grid of position weights
- `formula`: Scoring formula (vars: `value`, `weight`)

#### `merge_potential`
Rewards tiles that have matching neighbors (can merge).

```
COMPONENT merge_potential {
  formula: value * matches * 1e10
}
```

- `formula`: Scoring formula (vars: `value`, `matches`)

#### `empty_cells`
Rewards having empty cells.

```
COMPONENT empty_cells {
  formula: count * 1e12
}
```

- `formula`: Scoring formula (var: `count`)

#### `smoothness`
Penalizes large differences between neighboring tiles.

```
COMPONENT smoothness {
  formula: smoothness * 1e4
}
```

- `formula`: Scoring formula (var: `smoothness` - pre-calculated)

#### `max_tile`
Rewards the maximum tile value.

```
COMPONENT max_tile {
  formula: max_value^2 * 1e8
}
```

- `formula`: Scoring formula (var: `max_value`)

#### `corner_bonus`
Rewards having high-value tiles in any corner.

```
COMPONENT corner_bonus {
  formula: value^2 * 1e9
}
```

- `formula`: Scoring formula (var: `value`)

## Complete Strategy Examples

### Snake Pattern (Positional)
```
SEARCH {
  max_time: 80ms
  max_depth: 8
  pruning: top_3_cells
}

COMPONENT monotonic_path {
  path: [[0,0], [0,1], [0,2], [0,3], [1,3], [1,2], [1,1], [1,0], [2,0], [2,1], [2,2], [2,3], [3,3], [3,2], [3,1], [3,0]]
  position_score: value^2 * 10^(15-index)
  break_penalty: value_diff * 10^(16-index)
}

COMPONENT empty_cells {
  formula: count * 1e12
}

COMPONENT smoothness {
  formula: smoothness * 1e4
}

MOVES {
  fallback_order: [0, 3, 1, 2]
}
```

### Merge-Focused (Non-Positional)
Completely different! Doesn't care about tile positions, only merge opportunities.

```
SEARCH {
  max_time: 80ms
  max_depth: 7
}

COMPONENT merge_potential {
  formula: value * matches * 1e10
}

COMPONENT max_tile {
  formula: max_value^2 * 1e8
}

COMPONENT empty_cells {
  formula: count * 5e12
}

COMPONENT corner_bonus {
  formula: value^2 * 1e9
}

MOVES {
  fallback_order: [0, 1, 2, 3]
}
```

### Corner-Weight Strategy
Uses a weight grid instead of a path - different positional approach.

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

## Expression Syntax

Formulas support:
- **Arithmetic**: `+`, `-`, `*`, `/`
- **Exponentiation**: `^` (e.g., `value^2`)
- **Scientific notation**: `1e12`
- **Math functions**: `abs()`, `max()`, `min()`, `log2()`, `sqrt()`
- **Variables**: Depend on component type (see above)

## Search Parameters

```
SEARCH {
  max_time: 80ms      // Time limit per move
  max_depth: 8        // Maximum search depth
  pruning: top_3_cells  // Pruning strategy
}
```

## Move Fallbacks

```
MOVES {
  fallback_order: [0, 3, 1, 2]  // 0=Up, 1=Right, 2=Down, 3=Left
}
```

## Using Different Strategies

```javascript
// Load a specific strategy
const response = await fetch('/src/strategies/merge_focused.dsl');
const strategyText = await response.text();
const ai = new AI(strategyText);
```

## Creating Drastically Different Strategies

The key is choosing different components:

**Positional Strategies** use:
- `monotonic_path` OR `position_weights`
- `empty_cells`
- `smoothness`

**Non-Positional Strategies** use:
- `merge_potential`
- `max_tile`
- `corner_bonus`
- `empty_cells`

**Hybrid Strategies** can mix both!

## Tips

- **Higher scores win**: Larger formula values = higher priority
- **Balance is key**: One component shouldn't dominate (unless intentional)
- **Experiment**: Try removing components to see their impact
- **Scientific notation**: Use `1e12` for large weights to keep formulas readable
