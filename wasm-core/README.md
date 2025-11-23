# WASM Core Module

This directory contains the Rust source code for the PBF vector tile generation WASM module.

## Building

To build the WASM module, run:

```bash
npm run build:wasm
```

Or directly:

```bash
./scripts/build-wasm.sh
```

## Prerequisites

- Rust toolchain (rustc, cargo)
- wasm-pack: `cargo install wasm-pack`

## Structure

- `src/` - Rust source code
- `proto/` - Protocol Buffer definitions
- `build.rs` - Build script
- `Cargo.toml` - Cargo configuration

## Output

The built WASM files are output to `../src/wasm/`:
- `vector_tile_core.js` - JavaScript bindings
- `vector_tile_core_bg.wasm` - WASM binary
- `vector_tile_core.d.ts` - TypeScript definitions

