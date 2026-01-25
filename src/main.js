import './style.css';
import { Game } from './game.js';
import { AI } from './ai.js';

class GameManager {
  constructor() {
    this.game = new Game();
    this.aiRunning = false;
    this.aiInterval = null;
    this.aiWorker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    this.bestScore = parseInt(localStorage.getItem('best-score')) || 0;
    this.tileElements = new Map(); // id -> element

    this.initWorker();
    this.initElements();
    this.bindEvents();
    this.updateUI();
  }

  initElements() {
    this.tileContainer = document.getElementById('tile-container');
    this.scoreElement = document.getElementById('score');
    this.bestScoreElement = document.getElementById('best-score');
    this.newGameBtn = document.getElementById('new-game');
    this.aiToggleBtn = document.getElementById('ai-toggle');
    this.startTileSelector = document.getElementById('start-tile');
    this.statusOverlay = document.getElementById('status-overlay');
    this.statusMessage = document.getElementById('status-message');
    this.retryBtn = document.getElementById('retry-button');
    this.speedSlider = document.getElementById('ai-speed');
    this.speedDisplay = document.getElementById('speed-value');

    this.bestScoreElement.textContent = this.bestScore;
    this.speedDisplay.textContent = `Speed ${this.speedSlider.value}`;
  }

  initWorker() {
    this.aiWorker.onmessage = (e) => {
      const { move } = e.data;
      if (this.aiRunning && move !== -1) {
        this.game.move(move);
        this.handleMove();

        if (!this.game.over) {
          const speedFactor = parseInt(this.speedSlider.value);
          const delay = (15 - speedFactor) * 40 + 10;
          this.aiInterval = setTimeout(() => this.requestMove(), delay);
        } else {
          this.aiInterval = setTimeout(() => {
            if (this.aiRunning) this.restart();
          }, 1500);
        }
      } else if (this.aiRunning) {
        // No move found, likely game over
        this.aiInterval = setTimeout(() => {
          if (this.aiRunning) this.restart();
        }, 1500);
      }
    };
  }

  requestMove() {
    if (!this.aiRunning) return;
    this.aiWorker.postMessage({
      type: 'GET_MOVE',
      gameData: this.game.serialize()
    });
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.aiRunning) return;

      let moved = false;
      switch (e.key) {
        case 'ArrowUp': moved = this.game.move(0); e.preventDefault(); break;
        case 'ArrowRight': moved = this.game.move(1); e.preventDefault(); break;
        case 'ArrowDown': moved = this.game.move(2); e.preventDefault(); break;
        case 'ArrowLeft': moved = this.game.move(3); e.preventDefault(); break;
      }
      if (moved) this.handleMove();
    });

    this.newGameBtn.addEventListener('click', () => this.restart());
    this.retryBtn.addEventListener('click', () => this.restart());
    this.aiToggleBtn.addEventListener('click', () => this.toggleAI());
    this.speedSlider.addEventListener('input', () => {
      this.speedDisplay.textContent = `Speed ${this.speedSlider.value}`;
    });

    this.initTouchEvents();
  }

  initTouchEvents() {
    let touchStartX = 0;
    let touchStartY = 0;
    const gameContainer = document.getElementById('game-container');

    gameContainer.addEventListener('touchstart', (e) => {
      if (this.aiRunning) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gameContainer.addEventListener('touchend', (e) => {
      if (this.aiRunning) return;
      if (!touchStartX || !touchStartY) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 30) {
        // Move 0: Up, 1: Right, 2: Down, 3: Left
        let moved = false;
        if (absDx > absDy) {
          moved = this.game.move(dx > 0 ? 1 : 3);
        } else {
          moved = this.game.move(dy > 0 ? 2 : 0);
        }
        if (moved) this.handleMove();
      }

      touchStartX = 0;
      touchStartY = 0;
    }, { passive: true });
  }

  handleMove() {
    this.updateUI();
    if (this.game.over) {
      this.showStatus();
    }
  }

  updateUI() {
    const currentIds = new Set();

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const tile = this.game.grid[r][c];
        if (tile) {
          currentIds.add(tile.id);
          let element = this.tileElements.get(tile.id);

          if (!element) {
            // New tile or merged-into tile
            element = document.createElement('div');
            element.className = `tile tile-${tile.value > 8192 ? 'super' : tile.value}`;

            const inner = document.createElement('div');
            inner.className = 'tile-inner';
            inner.textContent = tile.value;
            element.appendChild(inner);

            if (tile.new) element.classList.add('tile-new');
            if (tile.mergedFrom) element.classList.add('tile-merged');

            this.tileContainer.appendChild(element);
            this.tileElements.set(tile.id, element);
          }

          // Update position (sliding) using top/left for perfect grid alignment
          // Offset = c * (cell_width + gap) => c * (25% + 0.25 * gap)
          element.style.left = `calc(${c} * (25% + var(--grid-gap) / 4))`;
          element.style.top = `calc(${r} * (25% + var(--grid-gap) / 4))`;

          element.className = `tile tile-${tile.value > 8192 ? 'super' : tile.value}`;
          element.querySelector('.tile-inner').textContent = tile.value;
          if (tile.mergedFrom) element.classList.add('tile-merged');
        }
      }
    }

    // Remove tiles that no longer exist
    for (const [id, element] of this.tileElements.entries()) {
      if (!currentIds.has(id)) {
        element.remove();
        this.tileElements.delete(id);
      }
    }

    this.scoreElement.textContent = this.game.score;
    if (this.game.score > this.bestScore) {
      this.bestScore = this.game.score;
      this.bestScoreElement.textContent = this.bestScore;
      localStorage.setItem('best-score', this.bestScore);
    }
  }

  showStatus() {
    this.statusMessage.textContent = 'Game Over!';
    this.statusOverlay.classList.add('active');
  }

  restart() {
    const startVal = this.startTileSelector.value;
    this.game = new Game();
    if (startVal) {
      this.game.grid = Array(4).fill().map(() => Array(4).fill(null));
      this.game.setup(parseInt(startVal));
    }
    this.statusOverlay.classList.remove('active');
    // Clear all existing elements
    this.tileContainer.innerHTML = '';
    this.tileElements.clear();
    this.updateUI();
    if (this.aiRunning) {
      this.requestMove();
    }
  }

  toggleAI() {
    if (this.aiRunning) {
      this.stopAI();
    } else {
      this.startAI();
    }
  }

  startAI() {
    if (this.aiRunning) return;

    // Auto-restart if game is over
    if (this.game.over) {
      this.restart();
    }

    this.aiRunning = true;
    this.aiToggleBtn.textContent = 'Stop AI';
    this.aiToggleBtn.classList.add('active');

    this.requestMove();
  }

  stopAI() {
    this.aiRunning = false;
    this.aiToggleBtn.textContent = 'Start AI';
    this.aiToggleBtn.classList.remove('active');
    if (this.aiInterval) {
      clearTimeout(this.aiInterval);
      this.aiInterval = null;
    }
  }
}

new GameManager();
