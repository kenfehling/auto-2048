// MERGE-FOCUSED STRATEGY
//
// Non-positional strategy that prioritizes creating merge opportunities over maintaining specific tile positions. Completely different from snake!

// Heavily reward tiles that have matching neighbors
COMPONENT merge_potential {
  formula: value * matches * 1e4
}

// Reward the maximum tile value (but not its position)
COMPONENT max_tile {
  formula: max_value^2 * 1e2
}

