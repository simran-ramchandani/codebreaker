/**
 * Code Breaker — Game Logic
 * game.js
 */
"use strict";

/* ──────────────────────────────────────────────
   CONSTANTS & STATE
────────────────────────────────────────────── */
const CELL = {
  OPEN:  1,
  WALL:  0,
  W2:    2,
  W3:    3,
  W4:    4,
  START: 'S',
  END:   'E',
  REQ:   'R',
};

const TOOL = { WALL: 'wall', ERASE: 'erase', WEIGHT: 'weight', PATH: 'path' };
const MODE = { BFS: 'bfs', DIJKSTRA: 'dijkstra', ASTAR: 'astar', VISIT: 'visit' };

const COLOR = {
  bg:       '#0f1f1a',
  open:     '#1f3a33',
  wall:     '#0f1f1a',
  start:    '#9bbc0f',
  end:      '#d8f0c0',
  optimal:  '#d8f0c0',
  user:     '#fff700',
  visited:  '#9cbc0f53',
  required: '#d8f0c0',
  w2:       '#3a706190',
  w3:       '#3a706163',
  w4:       '#3a70614a',
  grid:     '#162b25',
  hover:    'rgba(216,240,192,0.16)',
};

let state = {
  rows: 14,
  cols: 20,
  grid: [],            // 2D array of cell values
  special: {},         // "r,c" -> 'S'|'E'|'R'
  mode: MODE.BFS,
  tool: TOOL.WALL,
  drawing: false,
  userPath: [],
  userDrawing: false,
  lastCell: null,
  result: null,
  animStep: 0,
  animTimer: null,
  showVisited: true,
  animSpeed: 18,       // ms per step
  weightLevel: 2,
  requiredNodes: [],
  animPhase: 'idle',   // idle | visited | path
};

const canvas  = document.getElementById('grid-canvas');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('path-overlay');
const octx    = overlay.getContext('2d');

/* ──────────────────────────────────────────────
   GRID INIT
────────────────────────────────────────────── */
function initGrid() {
  const { rows, cols } = state;
  state.grid = Array.from({ length: rows }, () => new Array(cols).fill(CELL.OPEN));
  state.special = {};
  state.userPath = [];
  state.result = null;
  state.requiredNodes = [];
  state.animPhase = 'idle';
  clearAnim();

  // Default start / end
  setSpecial(Math.floor(rows / 2), 1, 'S');
  setSpecial(Math.floor(rows / 2), cols - 2, 'E');

  // Random obstacles (~18%)
  const density = 0.18;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (getSpecial(r, c)) continue;
      if (Math.random() < density) state.grid[r][c] = CELL.WALL;
    }
  }

  // For weighted mode: sprinkle weights
  if (state.mode === MODE.DIJKSTRA || state.mode === MODE.ASTAR) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.grid[r][c] === CELL.OPEN && !getSpecial(r, c)) {
          const rnd = Math.random();
          if (rnd < 0.08) state.grid[r][c] = CELL.W4;
          else if (rnd < 0.18) state.grid[r][c] = CELL.W3;
          else if (rnd < 0.32) state.grid[r][c] = CELL.W2;
        }
      }
    }
  }

  // For visit mode: add required nodes
  if (state.mode === MODE.VISIT) {
    const count = 3;
    let added = 0;
    let attempts = 0;
    while (added < count && attempts < 200) {
      attempts++;
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (!getSpecial(r, c) && state.grid[r][c] !== CELL.WALL) {
        setSpecial(r, c, 'R');
        state.requiredNodes.push({ r, c });
        added++;
      }
    }
  }

  resizeCanvas();
  drawGrid();
  resetStats();
  log('Grid initialised. Select a tool and draw your path.', 'info');
}

function setSpecial(r, c, type) {
  // Clear old entry for same type
  for (const [k, v] of Object.entries(state.special)) {
    if (v === type && type !== 'R') delete state.special[k];
  }
  state.special[`${r},${c}`] = type;
}

function getSpecial(r, c) {
  return state.special[`${r},${c}`] || null;
}

function getStart() {
  for (const [k, v] of Object.entries(state.special)) {
    if (v === 'S') { const [r,c] = k.split(',').map(Number); return {r,c}; }
  }
  return {r:0,c:0};
}
function getEnd() {
  for (const [k, v] of Object.entries(state.special)) {
    if (v === 'E') { const [r,c] = k.split(',').map(Number); return {r,c}; }
  }
  return {r:0,c:state.cols-1};
}

/* ──────────────────────────────────────────────
   CANVAS
────────────────────────────────────────────── */
const CELL_SZ = 36;
const GAP     = 2;

function resizeCanvas() {
  const { rows, cols } = state;
  const w = cols * CELL_SZ + (cols + 1) * GAP;
  const h = rows * CELL_SZ + (rows + 1) * GAP;
  canvas.width = w; canvas.height = h;
  overlay.width = w; overlay.height = h;
}

function cellColor(r, c) {
  const sp = getSpecial(r, c);
  if (sp === 'S') return COLOR.start;
  if (sp === 'E') return COLOR.end;
  if (sp === 'R') return COLOR.required;
  const v = state.grid[r][c];
  if (v === CELL.WALL) return COLOR.wall;
  if (v === CELL.W4)   return COLOR.w4;
  if (v === CELL.W3)   return COLOR.w3;
  if (v === CELL.W2)   return COLOR.w2;
  return COLOR.open;
}

function drawCell(r, c, fill, label, labelColor) {
  const x = c * CELL_SZ + (c + 1) * GAP;
  const y = r * CELL_SZ + (r + 1) * GAP;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, CELL_SZ, CELL_SZ);

  // Weight label
  const v = state.grid[r][c];
  if (!getSpecial(r,c) && v > 1 && v <= 4 && fill !== COLOR.wall) {
    ctx.fillStyle = 'rgba(202, 222, 241, 0.65)';
    ctx.font = `bold 10px "JetBrains Mono"`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(v, x + CELL_SZ - 3, y + CELL_SZ - 2);
  }

  if (label) {
    ctx.fillStyle = labelColor || '#000';
    ctx.font = `bold 11px "Orbitron"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CELL_SZ / 2, y + CELL_SZ / 2);
  }
}

function drawGrid() {
  const { rows, cols } = state;
  ctx.fillStyle = COLOR.grid;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sp = getSpecial(r, c);
      let fill = cellColor(r, c);
      let label = null, lc = null;
      if (sp === 'S') { label = 'A'; lc = '#000'; }
      if (sp === 'E') { label = 'B'; lc = '#000000'; }
      if (sp === 'R') { label = '!'; lc = '#000000'; }
      drawCell(r, c, fill, label, lc);
    }
  }

  octx.clearRect(0, 0, overlay.width, overlay.height);
}

/* ──────────────────────────────────────────────
   ANIMATION
────────────────────────────────────────────── */
function clearAnim() {
  if (state.animTimer) { clearTimeout(state.animTimer); state.animTimer = null; }
  state.animStep = 0;
  state.animPhase = 'idle';
  if (overlay) octx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawOverlayCell(r, c, color, alpha = 1) {
  const x = c * CELL_SZ + (c + 1) * GAP;
  const y = r * CELL_SZ + (r + 1) * GAP;
  octx.globalAlpha = alpha;
  octx.fillStyle = color;
  octx.fillRect(x + 2, y + 2, CELL_SZ - 4, CELL_SZ - 4);
  octx.globalAlpha = 1;
}

function drawPathLine(path, color, width = 3) {
  if (!path || path.length < 2) return;
  octx.strokeStyle = color;
  octx.lineWidth = width;
  octx.lineCap = 'round';
  octx.lineJoin = 'round';
  octx.shadowBlur = 8;
  octx.shadowColor = color;
  octx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const x = path[i].c * CELL_SZ + (path[i].c + 1) * GAP + CELL_SZ / 2;
    const y = path[i].r * CELL_SZ + (path[i].r + 1) * GAP + CELL_SZ / 2;
    i === 0 ? octx.moveTo(x, y) : octx.lineTo(x, y);
  }
  octx.stroke();
  octx.shadowBlur = 0;
}

function animateResult(result) {
  if (!result) return;
  clearAnim();
  const { explored, path: optPath } = result;
  const userPath = state.userPath;

  let step = 0;

  function tick() {
    if (state.animPhase === 'visited') {
      if (step < explored.length) {
        const { r, c } = explored[step];
        const sp = getSpecial(r, c);
        if (!sp) drawOverlayCell(r, c, COLOR.visited, 0.7);
        step++;
        state.animTimer = setTimeout(tick, state.animSpeed);
      } else {
        state.animPhase = 'path';
        step = 0;
        state.animTimer = setTimeout(tick, 100);
      }
    } else if (state.animPhase === 'path') {
      // Draw optimal path
      if (optPath && optPath.length) {
        octx.clearRect(0, 0, overlay.width, overlay.height);
        // Redraw visited
        if (state.showVisited) {
          explored.forEach(({ r, c }) => {
            if (!getSpecial(r, c)) drawOverlayCell(r, c, COLOR.visited, 0.7);
          });
        }
        // Animate path reveal
        const partial = optPath.slice(0, step + 1);
        drawPathLine(partial, COLOR.optimal, 3.5);
        if (step < optPath.length - 1) {
          step++;
          state.animTimer = setTimeout(tick, state.animSpeed * 2);
          return;
        }
      }
      // Draw user path on top
      if (userPath && userPath.length > 1) {
        drawPathLine(userPath, COLOR.user, 2.5);
      }
      state.animPhase = 'done';
      updateScoreBanner(result, userPath);
    }
  }

  state.animPhase = state.showVisited ? 'visited' : 'path';
  tick();
}

/* ──────────────────────────────────────────────
   USER PATH DRAWING
────────────────────────────────────────────── */
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top)  * scaleY;
  const c = Math.floor(px / (CELL_SZ + GAP));
  const r = Math.floor(py / (CELL_SZ + GAP));
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return null;
  return { r, c };
}

function applyTool(r, c) {
  const sp = getSpecial(r, c);
  if (sp === 'S' || sp === 'E') return; // never overwrite start/end
  const tool = state.tool;
  if (tool === TOOL.WALL) {
    if (sp === 'R') {
      delete state.special[`${r},${c}`];
      state.requiredNodes = state.requiredNodes.filter(n => !(n.r===r&&n.c===c));
    }
    state.grid[r][c] = CELL.WALL;
  } else if (tool === TOOL.ERASE) {
    if (sp === 'R') {
      delete state.special[`${r},${c}`];
      state.requiredNodes = state.requiredNodes.filter(n => !(n.r===r&&n.c===c));
    }
    state.grid[r][c] = CELL.OPEN;
  } else if (tool === TOOL.WEIGHT) {
    if (state.grid[r][c] !== CELL.WALL) {
      state.grid[r][c] = state.weightLevel;
    }
  }
}

function startUserPath(r, c) {
  const start = getStart();
  if (r !== start.r || c !== start.c) {
    log('Path must start from node A', 'warn');
    return;
  }
  state.userPath = [{ r, c }];
  state.userDrawing = true;
  state.lastCell = { r, c };
  clearAnim();
  drawGrid();
  octx.clearRect(0, 0, overlay.width, overlay.height);
  log('Drawing path... drag to node B', 'info');
}

function extendUserPath(r, c) {
  if (!state.userDrawing) return;
  const last = state.lastCell;
  if (!last) return;
  if (last.r === r && last.c === c) return;
  // Only allow adjacent steps
  if (Math.abs(last.r - r) + Math.abs(last.c - c) !== 1) return;
  if (state.grid[r][c] === CELL.WALL) return;
  // Prevent revisiting
  if (state.userPath.some(p => p.r === r && p.c === c)) return;
  state.userPath.push({ r, c });
  state.lastCell = { r, c };
  // Redraw overlay live
  octx.clearRect(0, 0, overlay.width, overlay.height);
  drawPathLine(state.userPath, COLOR.user, 2.5);
  // Reached end?
  const end = getEnd();
  if (r === end.r && c === end.c) finishUserPath();
}

function finishUserPath() {
  state.userDrawing = false;
  const end = getEnd();
  const last = state.lastCell;
  if (!last || last.r !== end.r || last.c !== end.c) {
    log('Path did not reach node B', 'warn');
    return;
  }
  log(`Path complete! ${state.userPath.length - 1} steps. Run solve to compare.`, 'ok');
  updateUserStats();
}

/* ──────────────────────────────────────────────
   CANVAS EVENTS
────────────────────────────────────────────── */
canvas.addEventListener('mousedown', e => {
  const cell = cellFromEvent(e);
  if (!cell) return;
  if (state.tool === TOOL.PATH) {
    startUserPath(cell.r, cell.c);
  } else {
    state.drawing = true;
    applyTool(cell.r, cell.c);
    drawGrid();
  }
});

canvas.addEventListener('mousemove', e => {
  const cell = cellFromEvent(e);
  if (!cell) return;
  if (state.tool === TOOL.PATH && state.userDrawing) {
    extendUserPath(cell.r, cell.c);
  } else if (state.drawing && state.tool !== TOOL.PATH) {
    applyTool(cell.r, cell.c);
    drawGrid();
  }
});

canvas.addEventListener('mouseup', () => {
  state.drawing = false;
  if (state.userDrawing) finishUserPath();
});

canvas.addEventListener('mouseleave', () => {
  state.drawing = false;
});

// Touch support
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const cell = cellFromEvent(touch);
  if (!cell) return;
  if (state.tool === TOOL.PATH) startUserPath(cell.r, cell.c);
  else { state.drawing = true; applyTool(cell.r, cell.c); drawGrid(); }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const cell = cellFromEvent(touch);
  if (!cell) return;
  if (state.tool === TOOL.PATH && state.userDrawing) extendUserPath(cell.r, cell.c);
  else if (state.drawing) { applyTool(cell.r, cell.c); drawGrid(); }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  state.drawing = false;
  if (state.userDrawing) finishUserPath();
});

/* ──────────────────────────────────────────────
   SOLVE
────────────────────────────────────────────── */
function solve() {
  const { rows, cols, mode, grid } = state;
  const start = getStart();
  const end   = getEnd();

  log(`Running ${mode.toUpperCase()} algorithm...`, 'info');

  let result;
  if (mode === MODE.BFS) {
    result = PathEngine.bfs(grid, start, end, rows, cols);
  } else if (mode === MODE.DIJKSTRA) {
    result = PathEngine.dijkstra(grid, start, end, rows, cols);
  } else if (mode === MODE.ASTAR) {
    result = PathEngine.astar(grid, start, end, rows, cols);
  } else if (mode === MODE.VISIT) {
    result = PathEngine.visitAll(grid, start, end, state.requiredNodes, rows, cols);
  }

  state.result = result;

  if (!result.found) {
    log('No path found! Try removing some obstacles.', 'err');
    return;
  }

  log(`Optimal: ${result.steps} steps, cost ${result.cost}, explored ${result.explored.length} cells`, 'ok');
  updateOptimalStats(result);

  // Also run all three for comparison
  const bfsR  = PathEngine.bfs(grid, start, end, rows, cols);
  const dijR  = PathEngine.dijkstra(grid, start, end, rows, cols);
  const astR  = PathEngine.astar(grid, start, end, rows, cols);
  updateAlgoComparison(bfsR, dijR, astR);

  drawGrid();
  animateResult(result);
}

/* ──────────────────────────────────────────────
   UI UPDATES
────────────────────────────────────────────── */
function resetStats() {
  setText('stat-opt-steps', '--');
  setText('stat-opt-cost', '--');
  setText('stat-usr-steps', '--');
  setText('stat-usr-cost', '--');
  setText('stat-explored', '--');
  setText('stat-efficiency', '--');
  setClass('stat-efficiency', '');
  document.getElementById('score-banner').style.display = 'none';
  document.querySelectorAll('.algo-val').forEach(el => el.textContent = '--');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setClass(id, cls) {
  const el = document.getElementById(id);
  if (el) el.className = `stat-value ${cls}`;
}

function updateOptimalStats(result) {
  setText('stat-opt-steps', result.steps);
  setText('stat-opt-cost', result.cost);
  setText('stat-explored', result.explored.length);
  setClass('stat-opt-steps', 'cyan');
  setClass('stat-opt-cost', 'cyan');
}

function updateUserStats() {
  const u = PathEngine.evalUserPath(state.userPath, state.grid, state.rows, state.cols);
  if (u.valid) {
    setText('stat-usr-steps', u.steps);
    setText('stat-usr-cost', u.cost);
    setClass('stat-usr-steps', 'amber');
    setClass('stat-usr-cost', 'amber');
  }
}

function updateAlgoComparison(bfs, dij, ast) {
  const el = (id) => document.getElementById(id);
  if (el('algo-bfs-steps'))  el('algo-bfs-steps').textContent  = bfs.found  ? bfs.steps  : '∞';
  if (el('algo-dij-cost'))   el('algo-dij-cost').textContent   = dij.found  ? dij.cost   : '∞';
  if (el('algo-ast-cost'))   el('algo-ast-cost').textContent   = ast.found  ? ast.cost   : '∞';
  if (el('algo-ast-expl'))   el('algo-ast-expl').textContent   = ast.found  ? ast.explored.length : '∞';
  if (el('algo-bfs-expl'))   el('algo-bfs-expl').textContent   = bfs.found  ? bfs.explored.length : '∞';
  if (el('algo-dij-expl'))   el('algo-dij-expl').textContent   = dij.found  ? dij.explored.length : '∞';
}

function updateScoreBanner(result, userPath) {
  const banner = document.getElementById('score-banner');
  const msg    = document.getElementById('score-msg');
  const badge  = document.getElementById('score-badge');
  if (!banner || !result.found) return;
  banner.style.display = 'flex';
  banner.classList.remove('valid', 'invalid');

  if (!userPath || userPath.length < 2) {
    msg.textContent = 'No user path drawn. Draw a path from A to B using the PATH tool.';
    badge.textContent = 'N/A';
    badge.className = 'score-badge ok';
    banner.classList.add('invalid');
    return;
  }

  const u = PathEngine.evalUserPath(userPath, state.grid, state.rows, state.cols);
  const end = getEnd();
  const reachedEnd = userPath.length > 0 &&
    userPath[userPath.length-1].r === end.r &&
    userPath[userPath.length-1].c === end.c;

  if (!u.valid || !reachedEnd) {
    msg.textContent = 'Your path is invalid or did not reach node B.';
    badge.textContent = 'INVALID';
    badge.className = 'score-badge bad';
    banner.classList.add('invalid');
    setText('stat-efficiency', '0%');
    return;
  }

  if (state.mode === MODE.VISIT) {
    const visitedRequired = new Set(userPath.map(p => `${p.r},${p.c}`));
    const missingRequired = state.requiredNodes.filter(n => !visitedRequired.has(`${n.r},${n.c}`));
    if (missingRequired.length > 0) {
      msg.textContent = `Wrong output: visit all required (!) nodes. Missing ${missingRequired.length}.`;
      badge.textContent = 'WRONG';
      badge.className = 'score-badge bad';
      banner.classList.add('invalid');
      setText('stat-efficiency', '0%');
      setClass('stat-efficiency', 'red');
      return;
    }
  }

  banner.classList.add('valid');

  const eff = result.steps > 0 ? Math.round(100 * result.steps / u.steps) : 0;
  setText('stat-efficiency', eff + '%');
  setClass('stat-efficiency', eff >= 95 ? 'green' : eff >= 75 ? 'cyan' : eff >= 50 ? 'amber' : 'red');
  setText('stat-usr-steps', u.steps);
  setText('stat-usr-cost', u.cost);

  if (eff >= 100) {
    msg.textContent = 'Perfect! Your path matches the optimal solution.';
    badge.textContent = 'OPTIMAL';
    badge.className = 'score-badge perfect';
  } else if (eff >= 80) {
    msg.textContent = `Good path! ${u.steps - result.steps} extra steps vs optimal.`;
    badge.textContent = eff + '%';
    badge.className = 'score-badge good';
  } else if (eff >= 50) {
    msg.textContent = `Decent attempt. Optimal uses ${result.steps} steps, you used ${u.steps}.`;
    badge.textContent = eff + '%';
    badge.className = 'score-badge ok';
  } else {
    msg.textContent = `Your path is far from optimal. Try again!`;
    badge.textContent = eff + '%';
    badge.className = 'score-badge bad';
  }
}

/* ──────────────────────────────────────────────
   LOG
────────────────────────────────────────────── */
const logEl = document.getElementById('log-box');
function log(msg, type = '') {
  if (!logEl) return;
  const ts = new Date().toTimeString().slice(0, 8);
  const span = document.createElement('span');
  span.className = `log-line ${type}`;
  span.textContent = `[${ts}] ${msg}`;
  logEl.appendChild(span);
  logEl.appendChild(document.createTextNode('\n'));
  logEl.scrollTop = logEl.scrollHeight;
}

/* ──────────────────────────────────────────────
   UI WIRING
────────────────────────────────────────────── */
// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    log(`Mode: ${btn.dataset.mode.toUpperCase()}`, 'info');
    initGrid();
  });
});

// Tool buttons
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    canvas.style.cursor = state.tool === TOOL.PATH ? 'crosshair' : 'cell';
  });
});

// Control buttons
document.getElementById('btn-solve')?.addEventListener('click', solve);
document.getElementById('btn-clear-path')?.addEventListener('click', () => {
  state.userPath = [];
  state.userDrawing = false;
  clearAnim();
  drawGrid();
  resetStats();
  log('User path cleared.', 'info');
});
document.getElementById('btn-new-grid')?.addEventListener('click', initGrid);
document.getElementById('btn-clear-walls')?.addEventListener('click', () => {
  for (let r = 0; r < state.rows; r++)
    for (let c = 0; c < state.cols; c++)
      if (state.grid[r][c] === CELL.WALL) state.grid[r][c] = CELL.OPEN;
  clearAnim();
  drawGrid();
  log('Walls cleared.', 'info');
});

// Speed slider
const speedSlider = document.getElementById('anim-speed');
if (speedSlider) {
  speedSlider.addEventListener('input', () => {
    const v = parseInt(speedSlider.value);
    state.animSpeed = Math.round(60 / v * 10);
    document.getElementById('speed-label').textContent = v;
  });
}

// Weight selector
const weightSelect = document.getElementById('weight-level');
if (weightSelect) {
  weightSelect.addEventListener('change', () => {
    state.weightLevel = parseInt(weightSelect.value);
  });
}

// Show visited toggle
const visitedToggle = document.getElementById('show-visited');
if (visitedToggle) {
  visitedToggle.addEventListener('change', () => {
    state.showVisited = visitedToggle.checked;
  });
}

/* ──────────────────────────────────────────────
   BOOTSTRAP
────────────────────────────────────────────── */
window.addEventListener('load', () => {
  initGrid();
  // Set default tool active
  document.querySelector('.tool-btn[data-tool="path"]')?.classList.add('active');
  state.tool = TOOL.PATH;
  log('Code Breaker initialised. Welcome, Operative.', 'info');
});
