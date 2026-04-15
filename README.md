# Code Breaker — Multi-Objective Pathfinding Puzzle

A cyberpunk-themed interactive grid-based puzzle where you navigate from **A → B** under
different constraints, with live comparison against classic pathfinding algorithms.

---

## Project Structure

```
codebreaker/
├── index.html            ← Main game UI (open in any browser)
├── build.sh              ← Compile C++ backend
├── css/
│   └── style.css         ← Cyberpunk terminal UI
├── js/
│   ├── algorithms.js     ← JS port of BFS / Dijkstra / A* (browser)
│   └── game.js           ← Grid engine, interaction, animation
└── cpp/
    ├── algorithms.cpp    ← Full C++ implementation
    └── sample_input.txt  ← Example input for binary
```

---

## Quick Start — Browser (No Install Required)

Just open **index.html** in any modern browser. No server needed.

---

## C++ Backend

### Compile

```bash
chmod +x build.sh
./build.sh
```

Or manually:

```bash
g++ -std=c++17 -O2 -o cpp/algorithms cpp/algorithms.cpp
```

### Run

```bash
./cpp/algorithms cpp/sample_input.txt output.json
cat output.json
```

### Input Format

```
MODE <bfs|dijkstra|astar>
GRID <rows> <cols>
START <row> <col>
END <row> <col>
OBSTACLES <count>
<r> <c>
...
WEIGHTS <count>          (optional, for weighted modes)
<r> <c> <weight>
...
USERPATH <count>         (optional, your path to evaluate)
<r> <c>
...
```

### Output

JSON with:
- `algorithm` — which algorithm was used
- `found` — whether a path exists
- `optimalPath` — list of `{r, c}` cells
- `optimalSteps` — number of moves
- `optimalCost` — total weighted cost
- `nodesExplored` — cells visited during search
- `userPath` — your path
- `userSteps` / `userCost` — your path metrics
- `efficiency` — your % efficiency vs optimal (0–100)

---

## Game Modes

| Mode | Algorithm | Objective |
|------|-----------|-----------|
| Shortest Path | BFS | Fewest steps (unweighted) |
| Weighted Path | Dijkstra | Minimum total cell cost |
| Heuristic | A* | Fast & optimal via Manhattan heuristic |
| Visit All Nodes | A* + waypoints | Hit all required (!) nodes then reach B |

---

## Data Structures Used

| Structure | Used In |
|-----------|---------|
| Queue (`std::queue`) | BFS frontier |
| Priority Queue (`std::priority_queue`) | Dijkstra & A* open set |
| Hash Map (`std::unordered_map`) | dist, gScore, parent tracking |
| Hash Set (`std::unordered_set`) | Visited / closed set |
| 2D Array / Vector | Grid representation |

---

## Algorithms

### BFS (Breadth-First Search)
- Explores level by level (uniform cost = 1)
- Guaranteed shortest path in unweighted grids
- Time: O(V + E), Space: O(V)

### Dijkstra
- Priority-queue based weighted search
- Guaranteed optimal for non-negative weights
- Time: O((V + E) log V), Space: O(V)

### A*
- Dijkstra + Manhattan-distance heuristic
- Explores far fewer cells than Dijkstra on open grids
- Time: O(E log V) best case, Space: O(V)

---

## UI Controls

- **PATH tool** — drag from A to B to draw your path
- **WALL tool** — click/drag to place obstacles  
- **ERASE tool** — remove walls  
- **WEIGHT tool** — set cell cost (2–4)
- **▶ SOLVE** — run algorithm, animate, compare
- **New Grid** — randomise fresh puzzle

---

## Requirements

- Browser UI: Any modern browser (Chrome, Firefox, Edge, Safari)
- C++ binary: g++ or clang++ with C++17 support
