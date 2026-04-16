/**
 * Snake Game 🐍✨
 * ──────────────────────────────────────
 * A pastel-themed Snake game with smooth
 * canvas rendering, sound effects, and
 * mobile support.
 * ──────────────────────────────────────
 */

// ─── Constants ───────────────────────────────────────
const GRID_SIZE = 20;           // Number of columns/rows
const BASE_CELL_SIZE = 24;      // Pixel size per cell (adjusted dynamically)

const SPEED_MAP = {
  slow: 150,
  medium: 110,
  fast: 70,
};

// Fruit emojis for food
const FOOD_EMOJIS = ['🍓', '🍒', '🍑', '🫐', '🍇', '🥝', '🍎'];

// Directions
const DIR = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};

// Opposite directions (to prevent 180° turns)
const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// Key mappings
const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up',
  s: 'down', S: 'down',
  a: 'left', A: 'left',
  d: 'right', D: 'right',
};

// ─── Audio Generation (Web Audio API) ────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

/** Ensure audio context is initialized (must happen on user gesture) */
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/** Play a cheerful "eat" sound */
function playEatSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587, audioCtx.currentTime);       // D5
    osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.08); // G5
    osc.frequency.setValueAtTime(988, audioCtx.currentTime + 0.15); // B5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (_) { /* ignore audio errors */ }
}

/** Play a sad "game over" sound */
function playGameOverSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (_) { /* ignore audio errors */ }
}

// ─── DOM Elements ────────────────────────────────────
const canvas        = document.getElementById('game-canvas');
const ctx           = canvas.getContext('2d');
const startBtn      = document.getElementById('start-btn');
const pauseBtn      = document.getElementById('pause-btn');
const speedSelect   = document.getElementById('speed-select');
const scoreEl       = document.getElementById('current-score');
const highScoreEl   = document.getElementById('high-score');
const gameOverlay   = document.getElementById('game-overlay');
const overlayStart  = document.getElementById('overlay-start-btn');
const gameoverOvl   = document.getElementById('gameover-overlay');
const finalScoreEl  = document.getElementById('final-score');
const newBestEl     = document.getElementById('new-best');
const restartBtn    = document.getElementById('restart-btn');
const gameWrapper   = document.getElementById('game-wrapper');
const mobileCtrlDiv = document.getElementById('mobile-controls');

// ─── Game State ──────────────────────────────────────
let snake          = [];        // Array of { x, y } positions (head first)
let direction      = 'right';   // Current direction
let nextDirection  = 'right';   // Buffered next direction
let food           = null;      // { x, y, emoji }
let score          = 0;
let highScore      = 0;
let gameRunning    = false;
let gamePaused     = false;
let gameLoopId     = null;
let cellSize       = BASE_CELL_SIZE;
let canvasSize     = GRID_SIZE * cellSize;
let eatAnimTime    = 0;         // Timestamp of last eat (for pulse animation)
let speedIncreases = 0;         // Number of speed-ups applied

// ─── Initialization ──────────────────────────────────

/** Calculate cell size based on viewport and set canvas dimensions */
function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth - 32, 580);
  cellSize = Math.floor(maxWidth / GRID_SIZE);
  if (cellSize < 14) cellSize = 14;
  if (cellSize > 30) cellSize = 30;
  canvasSize = GRID_SIZE * cellSize;
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
}

/** Load high score from localStorage */
function loadHighScore() {
  const stored = localStorage.getItem('snakeHighScore');
  highScore = stored ? parseInt(stored, 10) : 0;
  highScoreEl.textContent = highScore;
}

/** Save high score to localStorage */
function saveHighScore() {
  localStorage.setItem('snakeHighScore', highScore);
}

/** Initialize/reset the game state */
function initGame() {
  // Place snake in the center-left of the grid
  const startX = Math.floor(GRID_SIZE / 4);
  const startY = Math.floor(GRID_SIZE / 2);
  snake = [
    { x: startX + 2, y: startY },
    { x: startX + 1, y: startY },
    { x: startX,     y: startY },
  ];
  direction = 'right';
  nextDirection = 'right';
  score = 0;
  speedIncreases = 0;
  updateScore(0);
  spawnFood();
  draw();
}

/** Start the game loop */
function startGame() {
  ensureAudio();
  if (gameRunning) return;
  gameRunning = true;
  gamePaused = false;
  startBtn.innerHTML = '<span class="btn-icon">🔄</span> Restart';
  pauseBtn.disabled = false;
  pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
  gameOverlay.classList.remove('visible');
  gameoverOvl.classList.remove('visible');
  speedSelect.disabled = true;
  initGame();
  scheduleLoop();
}

/** Get current game speed (interval in ms), factoring in speed-ups */
function getSpeed() {
  const base = SPEED_MAP[speedSelect.value] || SPEED_MAP.medium;
  // Reduce interval by 3ms for every 5 fruits eaten (gradually speeds up)
  const reduction = speedIncreases * 3;
  return Math.max(base - reduction, 40); // never go below 40ms
}

/** Schedule the game loop with the current speed */
function scheduleLoop() {
  if (gameLoopId) clearInterval(gameLoopId);
  gameLoopId = setInterval(gameStep, getSpeed());
}

/** One step of the game loop */
function gameStep() {
  if (!gameRunning || gamePaused) return;
  moveSnake();
  if (checkCollision()) {
    endGame();
    return;
  }
  checkFoodConsumption();
  draw();
}

// ─── Movement ────────────────────────────────────────

/** Move the snake one cell in the current direction */
function moveSnake() {
  direction = nextDirection;
  const head = snake[0];
  const dir = DIR[direction];
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };
  snake.unshift(newHead);
  // Remove tail (unless eating, handled in checkFoodConsumption)
  snake.pop();
}

// ─── Collision Detection ─────────────────────────────

/** Check if the snake has collided with a wall or itself */
function checkCollision() {
  const head = snake[0];
  // Wall collision
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return true;
  }
  // Self collision (skip head itself at index 0)
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

// ─── Food ────────────────────────────────────────────

/** Spawn food at a random empty cell */
function spawnFood() {
  // Build set of occupied cells
  const occupied = new Set();
  for (const seg of snake) {
    occupied.add(`${seg.x},${seg.y}`);
  }
  // Collect all free cells
  const freeCells = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupied.has(`${x},${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }
  if (freeCells.length === 0) {
    // Snake fills the entire board! (win condition, effectively)
    food = null;
    return;
  }
  const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
  food = {
    x: pos.x,
    y: pos.y,
    emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
  };
}

/** Check if the snake's head is on the food */
function checkFoodConsumption() {
  if (!food) return;
  const head = snake[0];
  if (head.x === food.x && head.y === food.y) {
    // Grow: add a duplicate of the tail
    const tail = snake[snake.length - 1];
    snake.push({ x: tail.x, y: tail.y });
    // Score
    updateScore(score + 10);
    eatAnimTime = performance.now();
    // Emit particles
    emitEatParticles(food.x, food.y);
    // Sound
    playEatSound();
    // Possibly increase speed
    if (score > 0 && score % 50 === 0) {
      speedIncreases++;
      scheduleLoop(); // reschedule with new speed
    }
    // New food
    spawnFood();
  }
}

// ─── Score ────────────────────────────────────────────

/** Update the score display */
function updateScore(newScore) {
  score = newScore;
  scoreEl.textContent = score;
  // Bump animation
  scoreEl.classList.remove('bump');
  void scoreEl.offsetWidth; // reflow trigger
  scoreEl.classList.add('bump');
  setTimeout(() => scoreEl.classList.remove('bump'), 200);
}

// ─── Game Over ───────────────────────────────────────

/** End the game */
function endGame() {
  gameRunning = false;
  gamePaused = false;
  if (gameLoopId) clearInterval(gameLoopId);
  gameLoopId = null;
  pauseBtn.disabled = true;
  speedSelect.disabled = false;
  playGameOverSound();

  // Draw final frame with red tint on snake head
  draw(true);

  // Check high score
  const isNewBest = score > highScore;
  if (isNewBest) {
    highScore = score;
    highScoreEl.textContent = highScore;
    saveHighScore();
  }

  // Show game over overlay
  finalScoreEl.textContent = score;
  newBestEl.style.display = isNewBest ? 'block' : 'none';
  setTimeout(() => {
    gameoverOvl.classList.add('visible');
  }, 400);
}

// ─── Pause / Resume ──────────────────────────────────

function togglePause() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  if (gamePaused) {
    pauseBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    if (gameLoopId) clearInterval(gameLoopId);
    gameLoopId = null;
    // Draw "paused" state
    draw();
    drawPauseOverlay();
  } else {
    pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    scheduleLoop();
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(254, 249, 244, 0.7)';
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = '#4a3f5c';
  ctx.font = `bold ${cellSize * 1.2}px Outfit, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏸ Paused', canvasSize / 2, canvasSize / 2);
}

// ─── Eat Particles Effect ────────────────────────────

function emitEatParticles(gridX, gridY) {
  const wrapperRect = gameWrapper.getBoundingClientRect();
  const cx = gridX * cellSize + cellSize / 2;
  const cy = gridY * cellSize + cellSize / 2;
  const colors = ['#a8e6cf', '#c3aed6', '#ffd3b6', '#f8a5c2', '#ffeaa7'];
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'eat-particle';
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 20 + Math.random() * 15;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    particle.style.setProperty('--dx', dx + 'px');
    particle.style.setProperty('--dy', dy + 'px');
    particle.style.left = cx + 'px';
    particle.style.top = cy + 'px';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    gameWrapper.appendChild(particle);
    setTimeout(() => particle.remove(), 600);
  }
}

// ─── Drawing ─────────────────────────────────────────

/** Main draw function */
function draw(gameOverState = false) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  drawBackground();
  drawGrid();
  drawFood();
  drawSnake(gameOverState);
}

/** Draw the soft background */
function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
  gradient.addColorStop(0, '#fef9f4');
  gradient.addColorStop(0.5, '#fff5ee');
  gradient.addColorStop(1, '#fef0f5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
}

/** Draw subtle grid lines */
function drawGrid() {
  ctx.strokeStyle = 'rgba(195, 174, 214, 0.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvasSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvasSize, pos);
    ctx.stroke();
  }
}

/** Draw the food emoji */
function drawFood() {
  if (!food) return;
  const cx = food.x * cellSize + cellSize / 2;
  const cy = food.y * cellSize + cellSize / 2;
  // Subtle pulsing animation
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  // Soft glow behind food
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, cellSize * 0.7);
  glow.addColorStop(0, 'rgba(255, 211, 182, 0.35)');
  glow.addColorStop(1, 'rgba(255, 211, 182, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.7, 0, Math.PI * 2);
  ctx.fill();
  // Draw emoji
  ctx.font = `${cellSize * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(food.emoji, 0, 1);
  ctx.restore();
}

/** Draw the snake with rounded segments, gradient, and eyes */
function drawSnake(gameOverState = false) {
  const len = snake.length;
  const now = performance.now();
  // Check if we recently ate for a head pulse
  const eatPulse = (now - eatAnimTime < 200) ? 1 + (1 - (now - eatAnimTime) / 200) * 0.2 : 1;

  for (let i = len - 1; i >= 0; i--) {
    const seg = snake[i];
    const cx = seg.x * cellSize + cellSize / 2;
    const cy = seg.y * cellSize + cellSize / 2;
    const t = len > 1 ? i / (len - 1) : 0; // 0 = head, 1 = tail
    const radius = (cellSize / 2 - 1.5) * (1 - t * 0.2); // Tail segments slightly smaller

    // Color gradient from head to tail
    let color;
    if (gameOverState && i === 0) {
      color = '#f8a5c2'; // Pink head on game over
    } else {
      // Interpolate from mint-dark (head) to lavender-light (tail)
      const r = Math.round(108 + t * (221 - 108));
      const g = Math.round(196 + t * (209 - 196));
      const b = Math.round(161 + t * (234 - 161));
      color = `rgb(${r}, ${g}, ${b})`;
    }

    ctx.save();
    ctx.translate(cx, cy);

    // Apply eat pulse to head
    if (i === 0) {
      ctx.scale(eatPulse, eatPulse);
    }

    // Glow behind head
    if (i === 0) {
      const glowGrad = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.6);
      glowGrad.addColorStop(0, 'rgba(108, 196, 161, 0.25)');
      glowGrad.addColorStop(1, 'rgba(108, 196, 161, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body segment
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(108, 196, 161, 0.2)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Highlight on segment
    const highlight = ctx.createRadialGradient(-radius * 0.25, -radius * 0.25, 0, 0, 0, radius);
    highlight.addColorStop(0, 'rgba(255,255,255,0.35)');
    highlight.addColorStop(0.6, 'rgba(255,255,255,0.05)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes on head
    if (i === 0) {
      drawEyes(ctx, radius);
    }

    ctx.restore();
  }

  // Draw connectors between segments for a smoother look
  for (let i = 0; i < len - 1; i++) {
    const a = snake[i];
    const b = snake[i + 1];
    const ax = a.x * cellSize + cellSize / 2;
    const ay = a.y * cellSize + cellSize / 2;
    const bx = b.x * cellSize + cellSize / 2;
    const by = b.y * cellSize + cellSize / 2;
    const t1 = len > 1 ? i / (len - 1) : 0;
    const t2 = len > 1 ? (i + 1) / (len - 1) : 0;
    const r1 = (cellSize / 2 - 1.5) * (1 - t1 * 0.2);
    const r2 = (cellSize / 2 - 1.5) * (1 - t2 * 0.2);
    const connRadius = Math.min(r1, r2) * 0.65;

    // Only connect adjacent cells (not when wrapping isn't enabled)
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const r = Math.round(108 + ((t1 + t2) / 2) * (221 - 108));
      const g = Math.round(196 + ((t1 + t2) / 2) * (209 - 196));
      const bVal = Math.round(161 + ((t1 + t2) / 2) * (234 - 161));
      ctx.fillStyle = gameOverState && i === 0 ? '#f8a5c2' : `rgb(${r}, ${g}, ${bVal})`;
      ctx.beginPath();
      ctx.arc(mx, my, connRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draw cute eyes on the snake head */
function drawEyes(ctx, radius) {
  const dir = DIR[direction];
  const eyeOffset = radius * 0.35;
  const eyeRadius = radius * 0.2;
  const pupilRadius = eyeRadius * 0.55;

  // Calculate eye positions based on direction
  let leftEye, rightEye;
  if (dir.x === 1) {        // right
    leftEye  = { x: eyeOffset * 0.6, y: -eyeOffset };
    rightEye = { x: eyeOffset * 0.6, y:  eyeOffset };
  } else if (dir.x === -1) { // left
    leftEye  = { x: -eyeOffset * 0.6, y: -eyeOffset };
    rightEye = { x: -eyeOffset * 0.6, y:  eyeOffset };
  } else if (dir.y === -1) { // up
    leftEye  = { x: -eyeOffset, y: -eyeOffset * 0.6 };
    rightEye = { x:  eyeOffset, y: -eyeOffset * 0.6 };
  } else {                    // down
    leftEye  = { x: -eyeOffset, y: eyeOffset * 0.6 };
    rightEye = { x:  eyeOffset, y: eyeOffset * 0.6 };
  }

  for (const eye of [leftEye, rightEye]) {
    // White of eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(eye.x + dir.x * pupilRadius * 0.3, eye.y + dir.y * pupilRadius * 0.3, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    // Tiny highlight
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(eye.x - pupilRadius * 0.3, eye.y - pupilRadius * 0.3, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Continuous Redraw for Animations ────────────────
// We use requestAnimationFrame to keep food pulsing even while the game step uses setInterval.
let rafId = null;

function animationLoop() {
  if (gameRunning && !gamePaused) {
    // Only redraw for animations, game step handles logic
    draw();
  }
  rafId = requestAnimationFrame(animationLoop);
}

// ─── Event Listeners ─────────────────────────────────

// Keyboard controls
document.addEventListener('keydown', (e) => {
  const dir = KEY_MAP[e.key];
  if (dir) {
    e.preventDefault();
    if (gameRunning && !gamePaused) {
      // Prevent 180° turn
      if (dir !== OPPOSITE[direction]) {
        nextDirection = dir;
      }
    }
  }
  // Spacebar to pause
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    togglePause();
  }
});

// Start / Restart buttons
startBtn.addEventListener('click', () => {
  if (gameRunning) {
    // Restart
    endCurrentGame();
    startGame();
  } else {
    startGame();
  }
});

overlayStart.addEventListener('click', () => startGame());
restartBtn.addEventListener('click', () => startGame());
pauseBtn.addEventListener('click', () => togglePause());

/** End current game without showing game over */
function endCurrentGame() {
  gameRunning = false;
  gamePaused = false;
  if (gameLoopId) clearInterval(gameLoopId);
  gameLoopId = null;
}

// Speed selector
speedSelect.addEventListener('change', () => {
  // If game is running, update speed immediately
  if (gameRunning && !gamePaused) {
    scheduleLoop();
  }
});

// Mobile D-Pad controls
const dpadBtns = document.querySelectorAll('.dpad-btn');
dpadBtns.forEach(btn => {
  const handler = (e) => {
    e.preventDefault();
    const dir = btn.dataset.direction;
    if (dir && gameRunning && !gamePaused) {
      if (dir !== OPPOSITE[direction]) {
        nextDirection = dir;
      }
    }
    // If game hasn't started, start it
    if (!gameRunning) {
      startGame();
    }
  };
  btn.addEventListener('touchstart', handler, { passive: false });
  btn.addEventListener('mousedown', handler);
});

// Touch swipe support for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!gameRunning || gamePaused) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 20) return; // Too small, ignore

  let swipeDir;
  if (absDx > absDy) {
    swipeDir = dx > 0 ? 'right' : 'left';
  } else {
    swipeDir = dy > 0 ? 'down' : 'up';
  }
  if (swipeDir !== OPPOSITE[direction]) {
    nextDirection = swipeDir;
  }
}, { passive: true });

// Window resize
window.addEventListener('resize', () => {
  resizeCanvas();
  if (!gameRunning) {
    draw();
  }
});

// ─── Initial Setup ───────────────────────────────────
resizeCanvas();
loadHighScore();
initGame();

// Start animation loop for visual effects (food pulsing, etc.)
animationLoop();
