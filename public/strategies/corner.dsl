// CORNER-WEIGHT STRATEGY
//
// Positional strategy using a weight grid instead of a monotonic path. Prefers corners and edges over center positions.

SEARCH {
  max_time: 80ms
  max_depth: 8
  pruning: top_3_cells
}

// Position weights: corners best, edges good, center worst
COMPONENT position_weights {
  weights: [
    [100, 50, 20, 10],
    [50, 10, 5, 2],
    [20, 5, 2, 1],
    [10, 2, 1, 0.5]
  ]
  formula: value^2 * weight * 1e10
}

// Reward empty cells
COMPONENT empty_cells {
  formula: count * 1e12
}

// Reward smoothness
COMPONENT smoothness {
  formula: smoothness * 5e3
}

MOVES {
  fallback_order: [0, 3, 1, 2]
}
