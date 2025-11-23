/* tslint:disable */
/* eslint-disable */
/**
 * Generate PMTiles archive from GeoJSON (for Wasm)
 * 
 * # Arguments
 * * `geojson_bytes` - GeoJSON byte array
 * * `min_zoom` - Minimum zoom level
 * * `max_zoom` - Maximum zoom level
 * * `layer_name` - Layer name
 * 
 * # Returns
 * * `Result<Vec<u8>, JsValue>` - PMTiles file data on success, error message on failure
 */
export function generate_pmtiles_archive(geojson_bytes: Uint8Array, min_zoom: number, max_zoom: number, layer_name: string): Uint8Array;
/**
 * Output debug log (for Wasm bindgen)
 */
export function wasm_debug_log(message: string): void;
/**
 * Set panic hook for Wasm
 */
export function init_panic_hook(): void;
/**
 * Generate vector tiles from GeoJSON (for Wasm, with metadata)
 * 
 * # Arguments
 * * `geojson_bytes` - GeoJSON byte array
 * * `min_zoom` - Minimum zoom level
 * * `max_zoom` - Maximum zoom level
 * * `layer_name` - Layer name
 * 
 * # Returns
 * * `Result<TileResult, JsValue>` - TileResult on success, error message on failure
 */
export function generate_pbf_tiles(geojson_bytes: Uint8Array, min_zoom: number, max_zoom: number, layer_name: string): TileResult;
/**
 * Tile generation result (with metadata)
 */
export class TileResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get metadata
   */
  get_metadata(): any;
  /**
   * Get tile count
   */
  count(): number;
  /**
   * Get tile data at specified index
   */
  get_data(index: number): Uint8Array | undefined;
  /**
   * Get tile path at specified index
   */
  get_path(index: number): string | undefined;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_tileresult_free: (a: number, b: number) => void;
  readonly generate_pbf_tiles: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly generate_pmtiles_archive: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly tileresult_count: (a: number) => number;
  readonly tileresult_get_data: (a: number, b: number) => [number, number];
  readonly tileresult_get_metadata: (a: number) => any;
  readonly tileresult_get_path: (a: number, b: number) => [number, number];
  readonly wasm_debug_log: (a: number, b: number) => void;
  readonly init_panic_hook: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
