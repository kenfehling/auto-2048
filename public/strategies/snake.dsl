// SNAKE PATTERN STRATEGY
//
// Classic 2048 strategy that keeps tiles in a monotonic decreasing order along a snake-like path, with the largest tile in the top-left corner.

SEARCH {
  max_depth: 8
  pruning: top_3_cells
}

// Enforce monotonic decreasing order along the snake path
COMPONENT monotonic_path {
  path: [[0,0], [0,1], [0,2], [0,3], [1,3], [1,2], [1,1], [1,0], [2,0], [2,1], [2,2], [2,3], [3,3], [3,2], [3,1], [3,0]]
  position_score: value^2 * 10^(4-index)
  break_penalty: value_diff * 10^(5-index)
}

// Reward empty cells to keep the board alive
COMPONENT empty_cells {
  formula: count * 1e4
}

// Reward similar neighboring values (easier to merge)
COMPONENT smoothness {
  formula: smoothness * 1
}

MOVES {
  fallback_order: [0, 3, 1, 2]
}
