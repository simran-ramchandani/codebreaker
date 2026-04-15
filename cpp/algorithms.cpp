/*
 * Code Breaker: Multi-Objective Pathfinding Puzzle
 * algorithms.cpp - BFS, Dijkstra, A* implementations
 *
 * Compile: g++ -std=c++17 -O2 -o algorithms algorithms.cpp
 * Usage:   ./algorithms <input_file> <output_file>
 *
 * Input format (JSON-like plain text):
 *   MODE <bfs|dijkstra|astar>
 *   GRID <rows> <cols>
 *   START <row> <col>
 *   END <row> <col>
 *   OBSTACLES <count>
 *   <r> <c>   (repeated)
 *   WEIGHTS <count>
 *   <r> <c> <w>  (repeated, only for dijkstra/weighted)
 *   REQUIRED <count>
 *   <r> <c>   (repeated, for visit-all mode)
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <set>
#include <algorithm>
#include <climits>
#include <cmath>
#include <string>
#include <functional>

using namespace std;

// ─────────────────────────────────────────────
// Data Structures
// ─────────────────────────────────────────────

struct Cell {
    int r, c;
    bool operator==(const Cell& o) const { return r == o.r && c == o.c; }
    bool operator!=(const Cell& o) const { return !(*this == o); }
    bool operator<(const Cell& o) const {
        return r < o.r || (r == o.r && c < o.c);
    }
};

struct CellHash {
    size_t operator()(const Cell& c) const {
        return hash<int>()(c.r * 10007 + c.c);
    }
};

using Grid    = vector<vector<int>>;   // weights (1 = passable, 0 = wall, >1 = cost)
using ParentMap = unordered_map<int, int>;  // encoded cell -> encoded parent

inline int encode(int r, int c, int cols) { return r * cols + c; }
inline Cell decode(int id, int cols)      { return {id / cols, id % cols}; }

const int DR[] = {-1, 1, 0, 0};
const int DC[] = { 0, 0,-1, 1};

// ─────────────────────────────────────────────
// Path reconstruction
// ─────────────────────────────────────────────
vector<Cell> reconstructPath(const ParentMap& parent, Cell start, Cell end, int cols) {
    vector<Cell> path;
    int cur = encode(end.r, end.c, cols);
    int startId = encode(start.r, start.c, cols);
    while (cur != startId) {
        path.push_back(decode(cur, cols));
        auto it = parent.find(cur);
        if (it == parent.end()) return {}; // no path
        cur = it->second;
    }
    path.push_back(start);
    reverse(path.begin(), path.end());
    return path;
}

// ─────────────────────────────────────────────
// BFS — shortest path (unweighted)
// ─────────────────────────────────────────────
struct BFSResult {
    vector<Cell> path;
    int steps;
    bool found;
};

BFSResult bfs(const Grid& grid, Cell start, Cell end, int rows, int cols) {
    queue<Cell> q;
    unordered_set<int, hash<int>> visited;
    ParentMap parent;

    int startId = encode(start.r, start.c, cols);
    int endId   = encode(end.r,   end.c,   cols);

    q.push(start);
    visited.insert(startId);
    parent[startId] = startId;

    while (!q.empty()) {
        Cell cur = q.front(); q.pop();
        int curId = encode(cur.r, cur.c, cols);

        if (cur == end) {
            auto path = reconstructPath(parent, start, end, cols);
            return {path, (int)path.size() - 1, true};
        }

        for (int d = 0; d < 4; d++) {
            int nr = cur.r + DR[d];
            int nc = cur.c + DC[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (grid[nr][nc] == 0) continue;
            int nid = encode(nr, nc, cols);
            if (visited.count(nid)) continue;
            visited.insert(nid);
            parent[nid] = curId;
            q.push({nr, nc});
        }
    }
    return {{}, -1, false};
}

// ─────────────────────────────────────────────
// Dijkstra — weighted path
// ─────────────────────────────────────────────
struct DijkstraResult {
    vector<Cell> path;
    int totalCost;
    bool found;
};

DijkstraResult dijkstra(const Grid& grid, Cell start, Cell end, int rows, int cols) {
    // dist map
    unordered_map<int, int> dist;
    ParentMap parent;
    // priority queue: (cost, id)
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;

    int startId = encode(start.r, start.c, cols);
    int endId   = encode(end.r,   end.c,   cols);

    dist[startId] = 0;
    parent[startId] = startId;
    pq.push({0, startId});

    while (!pq.empty()) {
        auto [cost, uid] = pq.top(); pq.pop();
        Cell u = decode(uid, cols);

        if (dist.count(uid) && dist[uid] < cost) continue; // stale

        if (uid == endId) {
            auto path = reconstructPath(parent, start, end, cols);
            return {path, cost, true};
        }

        for (int d = 0; d < 4; d++) {
            int nr = u.r + DR[d];
            int nc = u.c + DC[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (grid[nr][nc] == 0) continue;
            int nid = encode(nr, nc, cols);
            int newCost = cost + grid[nr][nc];
            if (!dist.count(nid) || newCost < dist[nid]) {
                dist[nid] = newCost;
                parent[nid] = uid;
                pq.push({newCost, nid});
            }
        }
    }
    return {{}, INT_MAX, false};
}

// ─────────────────────────────────────────────
// A* — heuristic pathfinding
// ─────────────────────────────────────────────
struct AStarResult {
    vector<Cell> path;
    int totalCost;
    int nodesExplored;
    bool found;
};

inline int heuristic(Cell a, Cell b) {
    // Manhattan distance
    return abs(a.r - b.r) + abs(a.c - b.c);
}

AStarResult astar(const Grid& grid, Cell start, Cell end, int rows, int cols) {
    unordered_map<int, int> gScore;
    ParentMap parent;
    int explored = 0;

    // pq: (f, id)
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> open;
    unordered_set<int> closed;

    int startId = encode(start.r, start.c, cols);
    int endId   = encode(end.r,   end.c,   cols);

    gScore[startId] = 0;
    parent[startId] = startId;
    open.push({heuristic(start, end), startId});

    while (!open.empty()) {
        auto [f, uid] = open.top(); open.pop();

        if (closed.count(uid)) continue;
        closed.insert(uid);
        explored++;

        Cell u = decode(uid, cols);

        if (uid == endId) {
            auto path = reconstructPath(parent, start, end, cols);
            return {path, gScore[endId], explored, true};
        }

        for (int d = 0; d < 4; d++) {
            int nr = u.r + DR[d];
            int nc = u.c + DC[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (grid[nr][nc] == 0) continue;
            int nid = encode(nr, nc, cols);
            if (closed.count(nid)) continue;

            int newG = gScore[uid] + grid[nr][nc];
            if (!gScore.count(nid) || newG < gScore[nid]) {
                gScore[nid] = newG;
                parent[nid] = uid;
                int h = heuristic({nr, nc}, end);
                open.push({newG + h, nid});
            }
        }
    }
    return {{}, INT_MAX, 0, false};
}

// ─────────────────────────────────────────────
// Input / Output helpers
// ─────────────────────────────────────────────
void writeJSON(ofstream& out, const string& algo,
               const vector<Cell>& optPath, int cost, int steps,
               int explored, bool found, int rows, int cols,
               const vector<Cell>& userPath, int userCost, int userSteps)
{
    auto cellArr = [&](const vector<Cell>& v) {
        string s = "[";
        for (int i = 0; i < (int)v.size(); i++) {
            if (i) s += ",";
            s += "{\"r\":" + to_string(v[i].r) + ",\"c\":" + to_string(v[i].c) + "}";
        }
        return s + "]";
    };

    out << "{\n";
    out << "  \"algorithm\": \"" << algo << "\",\n";
    out << "  \"found\": " << (found ? "true" : "false") << ",\n";
    out << "  \"optimalPath\": " << cellArr(optPath) << ",\n";
    out << "  \"optimalSteps\": " << steps << ",\n";
    out << "  \"optimalCost\": " << cost << ",\n";
    out << "  \"nodesExplored\": " << explored << ",\n";
    out << "  \"userPath\": " << cellArr(userPath) << ",\n";
    out << "  \"userSteps\": " << userSteps << ",\n";
    out << "  \"userCost\": " << userCost << ",\n";
    out << "  \"efficiency\": " << (steps > 0 && userSteps > 0
        ? to_string((int)round(100.0 * steps / userSteps))
        : "0") << "\n";
    out << "}\n";
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────
int main(int argc, char* argv[]) {
    if (argc < 3) {
        cerr << "Usage: ./algorithms <input> <output>\n";
        return 1;
    }

    ifstream in(argv[1]);
    ofstream out(argv[2]);
    if (!in || !out) {
        cerr << "File error\n";
        return 1;
    }

    string token;
    string mode;
    int rows, cols;
    Cell start{}, end{};
    int obsCount = 0, weightCount = 0, reqCount = 0, userCount = 0;

    Grid grid;
    vector<Cell> userPath;
    vector<Cell> required;

    // Parse
    while (in >> token) {
        if (token == "MODE") {
            in >> mode;
        } else if (token == "GRID") {
            in >> rows >> cols;
            grid.assign(rows, vector<int>(cols, 1));
        } else if (token == "START") {
            in >> start.r >> start.c;
        } else if (token == "END") {
            in >> end.r >> end.c;
        } else if (token == "OBSTACLES") {
            in >> obsCount;
            for (int i = 0; i < obsCount; i++) {
                int r, c; in >> r >> c;
                if (r >= 0 && r < rows && c >= 0 && c < cols)
                    grid[r][c] = 0;
            }
        } else if (token == "WEIGHTS") {
            in >> weightCount;
            for (int i = 0; i < weightCount; i++) {
                int r, c, w; in >> r >> c >> w;
                if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] != 0)
                    grid[r][c] = w;
            }
        } else if (token == "REQUIRED") {
            in >> reqCount;
            for (int i = 0; i < reqCount; i++) {
                int r, c; in >> r >> c;
                required.push_back({r, c});
            }
        } else if (token == "USERPATH") {
            in >> userCount;
            for (int i = 0; i < userCount; i++) {
                int r, c; in >> r >> c;
                userPath.push_back({r, c});
            }
        }
    }

    // Compute user path cost
    int userCost = 0;
    bool userValid = !userPath.empty();
    for (int i = 0; i < (int)userPath.size(); i++) {
        int r = userPath[i].r, c = userPath[i].c;
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] == 0) {
            userValid = false; break;
        }
        if (i > 0) userCost += grid[r][c];
    }
    if (!userValid) { userPath.clear(); userCost = 0; }

    // Run algorithm
    if (mode == "bfs") {
        auto res = bfs(grid, start, end, rows, cols);
        int cost = res.found ? (int)res.path.size() - 1 : -1;
        writeJSON(out, "BFS", res.path, cost, res.steps, -1, res.found,
                  rows, cols, userPath, (int)userPath.size()-1, (int)userPath.size()-1);
    } else if (mode == "dijkstra") {
        auto res = dijkstra(grid, start, end, rows, cols);
        writeJSON(out, "Dijkstra", res.path, res.totalCost,
                  res.found ? (int)res.path.size()-1 : -1,
                  -1, res.found, rows, cols, userPath, userCost, (int)userPath.size()-1);
    } else if (mode == "astar") {
        auto res = astar(grid, start, end, rows, cols);
        writeJSON(out, "A*", res.path, res.totalCost,
                  res.found ? (int)res.path.size()-1 : -1,
                  res.nodesExplored, res.found, rows, cols,
                  userPath, userCost, (int)userPath.size()-1);
    } else {
        // Default: run all three and pick best
        auto bfsRes  = bfs(grid, start, end, rows, cols);
        auto dijRes  = dijkstra(grid, start, end, rows, cols);
        auto astRes  = astar(grid, start, end, rows, cols);
        // Write all as JSON array
        out << "[\n";
        // BFS
        out << "  {\"algorithm\":\"BFS\",\"found\":" << (bfsRes.found?"true":"false")
            << ",\"steps\":" << bfsRes.steps << "},\n";
        // Dijkstra
        out << "  {\"algorithm\":\"Dijkstra\",\"found\":" << (dijRes.found?"true":"false")
            << ",\"cost\":" << dijRes.totalCost << "},\n";
        // A*
        out << "  {\"algorithm\":\"A*\",\"found\":" << (astRes.found?"true":"false")
            << ",\"cost\":" << astRes.totalCost
            << ",\"explored\":" << astRes.nodesExplored << "}\n";
        out << "]\n";
    }

    return 0;
}
