/**
 * PBF (Vector Tiles) conversion utilities
 * Uses web-vector-tile-maker WASM library
 * 
 * Note: PBF conversion with WASM is handled in the WebWorker (convert.worker.ts)
 * This module provides helper functions for packaging tiles into ZIP format
 */

import JSZip from "jszip";

/**
 * Generate tiles.json metadata file
 */
export function generateTilesJson(
  minZoom: number,
  maxZoom: number,
  layerName: string,
  bounds?: [number, number, number, number],
  center?: [number, number]
): string {
  const centerZoom = Math.floor((minZoom + maxZoom) / 2);
  
  const tilesJson = {
    tilejson: "2.2.0",
    name: layerName,
    description: `${layerName} vector tiles`,
    version: "1.0.0",
    minzoom: minZoom,
    maxzoom: maxZoom,
    bounds: bounds || [-180, -85, 180, 85],
    center: center ? [center[0], center[1], centerZoom] : [0, 0, centerZoom],
    tiles: [`tiles/{z}/{x}/{y}.pbf`],
    vector_layers: [
      {
        id: layerName,
        description: "",
        minzoom: minZoom,
        maxzoom: maxZoom,
        fields: {},
      },
    ],
  };

  return JSON.stringify(tilesJson, null, 2);
}

/**
 * Convert tile files to ZIP archive
 * Helper function to package tiles into ZIP format
 * 
 * @param tiles - Array of tile files with path and data
 * @param metadata - Optional metadata for tiles.json
 * @returns ZIP archive containing {z}/{x}/{y}.pbf files and tiles.json
 */
export async function tilesToZip(
  tiles: Array<{ path: string; data: Uint8Array }>,
  metadata?: {
    minZoom: number;
    maxZoom: number;
    layerName: string;
    bounds?: [number, number, number, number];
    center?: [number, number];
  }
): Promise<ArrayBuffer> {
  try {
    const zip = new JSZip();

    // Add each tile to ZIP with path structure: tiles/{z}/{x}/{y}.pbf
    for (const tile of tiles) {
      zip.file(`tiles/${tile.path}`, tile.data);
    }

    // Add tiles.json if metadata is provided
    if (metadata) {
      const tilesJson = generateTilesJson(
        metadata.minZoom,
        metadata.maxZoom,
        metadata.layerName,
        metadata.bounds,
        metadata.center
      );
      zip.file("tiles.json", tilesJson);
    }

    // Generate ZIP as ArrayBuffer
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return zipBuffer;
  } catch (error) {
    throw new Error(
      `Failed to create ZIP from tiles: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Validate PBF options
 */
export function validatePbfOptions(
  minZoom: number,
  maxZoom: number,
  layerName: string
): void {
  if (minZoom < 0 || minZoom > 24 || maxZoom < 0 || maxZoom > 24) {
    throw new Error("Zoom levels must be between 0 and 24");
  }

  if (minZoom > maxZoom) {
    throw new Error("Minimum zoom must be less than or equal to maximum zoom");
  }

  if (!layerName || !layerName.trim()) {
    throw new Error("Layer name is required");
  }
}

