#!/bin/bash
# Build WASM module from Rust source code
# This script builds the WASM module and copies the output to src/wasm/

set -e

cd "$(dirname "$0")/../wasm-core"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Error: wasm-pack is not installed"
    echo "Install it with: cargo install wasm-pack"
    exit 1
fi

# Build WASM module
echo "Building WASM module..."
wasm-pack build --target web --out-dir ../src/wasm

echo "WASM build completed successfully!"
echo "Output files are in src/wasm/"

