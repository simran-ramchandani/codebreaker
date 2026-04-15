/**
 * Code Breaker — Pathfinding Engine (JavaScript)
 * Pure-JS port of the C++ algorithms for in-browser execution.
 * algorithms.js
 */

"use strict";

const PathEngine = (() => {

  // ── helpers ──────────────────────────────────────────────
  const encode = (r, c, cols) => r * cols + c;
  const decode = (id, cols) => ({ r: Math.floor(id / cols), c: id % cols });
  const DR = [-1, 1, 0, 0];
  const DC = [ 0, 0,-1, 1];

  function reconstructPath(parent, startId, endId, cols) {
    const path = [];
    let cur = endId;
    const seen = new Set();
    while (cur !== startId) {
      if (seen.has(cur)) return null; // cycle guard
      seen.add(cur);
      path.push(decode(cur, cols));
      if (!(cur in parent)) return null;
      cur = parent[cur];
    }
    path.push(decode(startId, cols));
    path.reverse();
    return path;
  }

  // ── BFS ──────────────────────────────────────────────────
  function bfs(grid, start, end, rows, cols) {
    const startId = encode(start.r, start.c, cols);
    const endId   = encode(end.r,   end.c,   cols);
    const visited = new Set([startId]);
    const parent  = { [startId]: startId };
    const queue   = [startId];
    const explored = [];
    let qi = 0;

    while (qi < queue.length) {
      const uid = queue[qi++];
      const u   = decode(uid, cols);
      explored.push(u);

      if (uid === endId) {
        const path = reconstructPath(parent, startId, endId, cols);
        return { path, steps: path.length - 1, cost: path.length - 1, explored, found: true };
      }

      for (let d = 0; d < 4; d++) {
        const nr = u.r + DR[d], nc = u.c + DC[d];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 0) continue;
        const nid = encode(nr, nc, cols);
        if (visited.has(nid)) continue;
        visited.add(nid);
        parent[nid] = uid;
        queue.push(nid);
      }
    }
    return { path: [], steps: -1, cost: -1, explored, found: false };
  }

  // ── Dijkstra ─────────────────────────────────────────────
  function dijkstra(grid, start, end, rows, cols) {
    const startId = encode(start.r, start.c, cols);
    const endId   = encode(end.r,   end.c,   cols);
    const dist    = { [startId]: 0 };
    const parent  = { [startId]: startId };
    const explored = [];

    // Simple min-heap
    const heap = new MinHeap((a, b) => a[0] - b[0]);
    heap.push([0, startId]);
    const closed = new Set();

    while (!heap.empty()) {
      const [cost, uid] = heap.pop();
      if (closed.has(uid)) continue;
      closed.add(uid);

      const u = decode(uid, cols);
      explored.push(u);

      if (uid === endId) {
        const path = reconstructPath(parent, startId, endId, cols);
        return { path, steps: path.length - 1, cost, explored, found: true };
      }

      for (let d = 0; d < 4; d++) {
        const nr = u.r + DR[d], nc = u.c + DC[d];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 0) continue;
        const nid = encode(nr, nc, cols);
        if (closed.has(nid)) continue;
        const newCost = cost + grid[nr][nc];
        if (dist[nid] === undefined || newCost < dist[nid]) {
          dist[nid] = newCost;
          parent[nid] = uid;
          heap.push([newCost, nid]);
        }
      }
    }
    return { path: [], steps: -1, cost: Infinity, explored, found: false };
  }

  // ── A* ───────────────────────────────────────────────────
  function heuristic(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

  function astar(grid, start, end, rows, cols) {
    const startId = encode(start.r, start.c, cols);
    const endId   = encode(end.r,   end.c,   cols);
    const gScore  = { [startId]: 0 };
    const parent  = { [startId]: startId };
    const explored = [];
    const closed  = new Set();

    const heap = new MinHeap((a, b) => a[0] - b[0]);
    heap.push([heuristic(start, end), startId]);

    while (!heap.empty()) {
      const [, uid] = heap.pop();
      if (closed.has(uid)) continue;
      closed.add(uid);

      const u = decode(uid, cols);
      explored.push(u);

      if (uid === endId) {
        const path = reconstructPath(parent, startId, endId, cols);
        return { path, steps: path.length - 1, cost: gScore[endId], explored, found: true };
      }

      for (let d = 0; d < 4; d++) {
        const nr = u.r + DR[d], nc = u.c + DC[d];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 0) continue;
        const nid = encode(nr, nc, cols);
        if (closed.has(nid)) continue;
        const ng = gScore[uid] + grid[nr][nc];
        if (gScore[nid] === undefined || ng < gScore[nid]) {
          gScore[nid] = ng;
          parent[nid] = uid;
          heap.push([ng + heuristic(decode(nid, cols), end), nid]);
        }
      }
    }
    return { path: [], steps: -1, cost: Infinity, explored, found: false };
  }

  // ── Visit all required nodes ───────────────────────────────
  function permutations(items) {
    const out = [];
    const used = new Array(items.length).fill(false);
    const cur = [];
    function dfs() {
      if (cur.length === items.length) {
        out.push(cur.slice());
        return;
      }
      for (let i = 0; i < items.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        cur.push(items[i]);
        dfs();
        cur.pop();
        used[i] = false;
      }
    }
    dfs();
    return out;
  }

  function visitAll(grid, start, end, requiredNodes, rows, cols) {
    const required = Array.isArray(requiredNodes) ? requiredNodes.slice() : [];
    if (required.length === 0) return astar(grid, start, end, rows, cols);

    const orders = permutations(required);
    let best = null;

    for (const order of orders) {
      const points = [start, ...order, end];
      let totalCost = 0;
      let fullPath = [];
      let fullExplored = [];
      let ok = true;

      for (let i = 0; i < points.length - 1; i++) {
        const seg = astar(grid, points[i], points[i + 1], rows, cols);
        if (!seg.found || !seg.path || seg.path.length < 2) {
          ok = false;
          break;
        }
        totalCost += seg.cost;
        fullExplored = fullExplored.concat(seg.explored || []);
        if (fullPath.length === 0) {
          fullPath = seg.path.slice();
        } else {
          // Avoid duplicating joint waypoint.
          fullPath = fullPath.concat(seg.path.slice(1));
        }
      }

      if (!ok || fullPath.length < 2) continue;

      const candidate = {
        path: fullPath,
        steps: fullPath.length - 1,
        cost: totalCost,
        explored: fullExplored,
        found: true,
      };

      if (
        !best ||
        candidate.cost < best.cost ||
        (candidate.cost === best.cost && candidate.steps < best.steps)
      ) {
        best = candidate;
      }
    }

    return best || { path: [], steps: -1, cost: Infinity, explored: [], found: false };
  }

  // ── MinHeap ───────────────────────────────────────────────
  class MinHeap {
    constructor(cmp) { this._h = []; this._cmp = cmp; }
    empty() { return this._h.length === 0; }
    push(v)  {
      this._h.push(v);
      let i = this._h.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this._cmp(this._h[i], this._h[p]) < 0) {
          [this._h[i], this._h[p]] = [this._h[p], this._h[i]]; i = p;
        } else break;
      }
    }
    pop() {
      const top = this._h[0];
      const last = this._h.pop();
      if (this._h.length > 0) {
        this._h[0] = last;
        let i = 0;
        while (true) {
          let s = i, l = 2*i+1, r = 2*i+2;
          if (l < this._h.length && this._cmp(this._h[l], this._h[s]) < 0) s = l;
          if (r < this._h.length && this._cmp(this._h[r], this._h[s]) < 0) s = r;
          if (s === i) break;
          [this._h[i], this._h[s]] = [this._h[s], this._h[i]]; i = s;
        }
      }
      return top;
    }
  }

  // ── compute user path cost ────────────────────────────────
  function evalUserPath(userPath, grid, rows, cols) {
    if (!userPath || userPath.length < 2) return { valid: false, steps: 0, cost: 0 };
    let cost = 0;
    for (let i = 0; i < userPath.length; i++) {
      const { r, c } = userPath[i];
      if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === 0)
        return { valid: false, steps: 0, cost: 0 };
      if (i > 0) cost += grid[r][c];
    }
    return { valid: true, steps: userPath.length - 1, cost };
  }

  // ── public API ────────────────────────────────────────────
  return { bfs, dijkstra, astar, visitAll, evalUserPath };
})();

// Export for Node / browser
if (typeof module !== "undefined") module.exports = PathEngine;
