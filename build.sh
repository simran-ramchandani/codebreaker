#!/bin/bash
# ──────────────────────────────────────────────────────────
# Code Breaker — Build Script
# Compiles the C++ algorithms binary
# ──────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Code Breaker — Build System            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

CPP_SRC="cpp/algorithms.cpp"
CPP_OUT="cpp/algorithms"

# Detect compiler
if command -v g++ &>/dev/null; then
  CXX="g++"
elif command -v clang++ &>/dev/null; then
  CXX="clang++"
else
  echo "❌  No C++ compiler found. Please install g++ or clang++."
  exit 1
fi

echo "[1/2] Compiling C++ backend..."
$CXX -std=c++17 -O2 -o "$CPP_OUT" "$CPP_SRC"
echo "      ✅  Built: $CPP_OUT"
echo ""

echo "[2/2] C++ usage example:"
echo "      ./cpp/algorithms input.txt output.txt"
echo ""
echo "      input.txt format:"
echo "        MODE bfs"
echo "        GRID 14 20"
echo "        START 7 1"
echo "        END 7 18"
echo "        OBSTACLES 5"
echo "        3 4"
echo "        3 5"
echo "        3 6"
echo "        8 10"
echo "        9 10"
echo "        USERPATH 3"
echo "        7 1"
echo "        7 2"
echo "        7 18"
echo ""
echo "────────────────────────────────────────────"
echo "To run the browser UI, open index.html"
echo "(no server required — runs 100% in-browser)"
echo "────────────────────────────────────────────"
