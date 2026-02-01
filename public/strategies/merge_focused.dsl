// MERGE-FOCUSED STRATEGY
//
// Non-positional strategy that prioritizes creating merge opportunities over maintaining specific tile positions. Completely different from snake!

SEARCH {
  max_depth: 7
  pruning: top_3_cells
}

// Heavily reward tiles that have matching neighbors
COMPONENT merge_potential {
  formula: value * matches * 1e4
}

// Reward the maximum tile value (but not its position)
COMPONENT max_tile {
  formula: max_value^2 * 1e2
}

// Heavily reward empty spaces to maintain flexibility
COMPONENT empty_cells {
  formula: count * 1e4
}

// Small bonus for keeping high tiles in corners (any corner)
COMPONENT corner_bonus {
  formula: value^2 * 1e3
}

MOVES {
  fallback_order: [0, 1, 2, 3]
}
