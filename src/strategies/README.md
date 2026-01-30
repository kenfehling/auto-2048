# 2048 AI Strategies

This directory contains different AI strategies written in the Strategy DSL.

## Available Strategies

### 🐍 Snake Pattern (`../strategy.dsl`)
**Default strategy** - Classic 2048 approach
- **Type**: Positional (monotonic path)
- **Performance**: High scores, consistent 2048+ tiles
- **How it works**: Maintains tiles in decreasing order along a snake-like path
- **Best for**: Maximum scores, reaching high tiles (4096+)

### 🔀 Merge-Focused (`merge_focused.dsl`)
**Experimental** - Non-positional strategy
- **Type**: Opportunistic (merge-driven)
- **Performance**: Moderate scores, more chaotic
- **How it works**: Prioritizes creating merge opportunities over tile positions
- **Best for**: Understanding non-positional strategies, experimentation

### 📐 Corner-Weight (`corner.dsl`)
**Alternative positional** - Grid-based weighting
- **Type**: Positional (2D weights)
- **Performance**: Good scores, balanced gameplay
- **How it works**: Uses a weight grid favoring corners and edges
- **Best for**: More flexible positional play than snake

## Quick Comparison

| Strategy | Positional? | Complexity | Score Potential | Playstyle |
|----------|-------------|------------|-----------------|-----------|
| Snake Pattern | ✅ Path-based | Medium | ⭐⭐⭐⭐⭐ | Methodical |
| Merge-Focused | ❌ No positions | Low | ⭐⭐⭐ | Chaotic |
| Corner-Weight | ✅ Grid-based | Medium | ⭐⭐⭐⭐ | Balanced |

## Using a Different Strategy

To use a different strategy, modify `src/ai-worker.js`:

```javascript
// Change this line:
const response = await fetch('/src/strategy.dsl');

// To this:
const response = await fetch('/src/strategies/merge_focused.dsl');
```

Or pass the strategy text directly to the AI constructor:

```javascript
const strategyText = await fetch('/src/strategies/corner.dsl').then(r => r.text());
const ai = new AI(strategyText);
```

## Creating Your Own Strategy

1. Copy an existing `.dsl` file
2. Modify the components and their parameters
3. Test by loading it in the AI
4. Iterate based on performance

See `../STRATEGY_DSL.md` for complete documentation on the DSL syntax and available components.
