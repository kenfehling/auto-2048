export class Game {
  constructor(size = 4) {
    this.size = size;
    this.grid = Array(size).fill().map(() => Array(size).fill(null));
    this.score = 0;
    this.over = false;
    this.won = false;
    this.nextId = 1;
    this.setup();
  }

  setup(startValue = null) {
    if (startValue) {
      this.addSpecificTile(startValue);
      this.addRandomTile();
    } else {
      this.addRandomTile();
      this.addRandomTile();
    }
  }

  addSpecificTile(value) {
    const corners = [
      { r: 0, c: 0 },
      { r: 0, c: this.size - 1 },
      { r: this.size - 1, c: 0 },
      { r: this.size - 1, c: this.size - 1 }
    ];
    // Find an empty corner or just any corner
    const corner = corners.find(cor => this.grid[cor.r][cor.c] === null) || corners[0];
    this.grid[corner.r][corner.c] = {
      id: this.nextId++,
      value: value,
      mergedFrom: null,
      new: true
    };
  }

  addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.grid[r][c] = {
        id: this.nextId++,
        value: Math.random() < 0.9 ? 2 : 4,
        mergedFrom: null,
        new: true
      };
    }
  }

  move(direction, skipRandomTile = false) {
    if (this.over) return false;

    // Clear metadata
    this.clearMetadata();

    const oldGridState = Array(this.size).fill().map((_, r) =>
      this.grid[r].map(cell => cell ? cell.value : 0)
    );

    let moved = false;

    // Mapping: 0: Up, 1: Right, 2: Down, 3: Left
    // We want to rotate so the target direction is Left (column 0)
    // Up -> 3 rotations CW
    // Right -> 2 rotations CW
    // Down -> 1 rotation CW
    // Left -> 0 rotations CW
    const rotations = [3, 2, 1, 0][direction];

    for (let i = 0; i < rotations; i++) {
      this.grid = this.rotate(this.grid);
    }

    for (let r = 0; r < this.size; r++) {
      let lastFreeColumn = 0;
      for (let c = 1; c < this.size; c++) {
        if (this.grid[r][c]) {
          let targetC = c;
          // Move as far left as possible
          while (targetC > lastFreeColumn && !this.grid[r][targetC - 1]) {
            targetC--;
          }

          if (targetC > 0 && this.grid[r][targetC - 1] &&
            this.grid[r][targetC - 1].value === this.grid[r][c].value &&
            !this.grid[r][targetC - 1].mergedFrom) {
            // Merge
            const val = this.grid[r][c].value * 2;
            const mergedTile = {
              id: this.nextId++,
              value: val,
              mergedFrom: [this.grid[r][targetC - 1].id, this.grid[r][c].id],
              new: false
            };
            this.grid[r][targetC - 1] = mergedTile;
            this.grid[r][c] = null;
            this.score += val;
            if (val === 2048) this.won = true;
            moved = true;
            // The column before this one is now the limit for further merges in this move
            lastFreeColumn = targetC;
          } else if (targetC !== c) {
            // Just move
            this.grid[r][targetC] = this.grid[r][c];
            this.grid[r][c] = null;
            moved = true;
          }
        }
      }
    }

    for (let i = 0; i < (4 - rotations) % 4; i++) {
      this.grid = this.rotate(this.grid);
    }

    if (moved) {
      if (!skipRandomTile) {
        this.addRandomTile();
      }
      if (!this.movesAvailable()) {
        this.over = true;
      }
    }

    return moved;
  }

  clearMetadata() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c]) {
          this.grid[r][c].mergedFrom = null;
          this.grid[r][c].new = false;
        }
      }
    }
  }

  rotate(grid) {
    const newGrid = Array(this.size).fill().map(() => Array(this.size).fill(null));
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        newGrid[c][this.size - 1 - r] = grid[r][c];
      }
    }
    return newGrid;
  }

  movesAvailable() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) return true;
        const val = this.grid[r][c].value;
        if (c < this.size - 1 && this.grid[r][c + 1] && this.grid[r][c + 1].value === val) return true;
        if (r < this.size - 1 && this.grid[r + 1][c] && this.grid[r + 1][c].value === val) return true;
      }
    }
    return false;
  }

  serialize() {
    return {
      grid: this.grid.map(row => row.map(cell => cell ? ({ ...cell }) : null)),
      score: this.score,
      over: this.over,
      won: this.won,
      nextId: this.nextId
    };
  }

  static fromState(state) {
    const game = new Game(state.grid.length);
    game.grid = state.grid.map(row => row.map(cell => cell ? ({ ...cell }) : null));
    game.score = state.score;
    game.over = state.over;
    game.won = state.won;
    game.nextId = state.nextId;
    return game;
  }
}
