// WebAssembly API
// Wasm functions called from browser

use wasm_bindgen::prelude::*;
use crate::generate_tiles_with_metadata;

/// Set panic hook for Wasm
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Tile generation result (with metadata)
#[wasm_bindgen]
pub struct TileResult {
    tiles: Vec<TileData>,
    metadata: MetadataData,
}

#[wasm_bindgen]
impl TileResult {
    /// Get tile count
    pub fn count(&self) -> usize {
        self.tiles.len()
    }
    
    /// Get tile path at specified index
    pub fn get_path(&self, index: usize) -> Option<String> {
        self.tiles.get(index).map(|t| t.path.clone())
    }
    
    /// Get tile data at specified index
    pub fn get_data(&self, index: usize) -> Option<Vec<u8>> {
        self.tiles.get(index).map(|t| t.data.clone())
    }
    
    /// Get metadata
    pub fn get_metadata(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.metadata).unwrap_or(JsValue::NULL)
    }
}

#[derive(Clone)]
struct TileData {
    path: String,
    data: Vec<u8>,
}

#[derive(Clone, serde::Serialize)]
struct MetadataData {
    min_zoom: u8,
    max_zoom: u8,
    layer_name: String,
    bounds: (f64, f64, f64, f64),
    center: (f64, f64),
}

/// Generate vector tiles from GeoJSON (for Wasm, with metadata)
/// 
/// # Arguments
/// * `geojson_bytes` - GeoJSON byte array
/// * `min_zoom` - Minimum zoom level
/// * `max_zoom` - Maximum zoom level
/// * `layer_name` - Layer name
/// 
/// # Returns
/// * `Result<TileResult, JsValue>` - TileResult on success, error message on failure
#[wasm_bindgen]
pub fn generate_pbf_tiles(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<TileResult, JsValue> {
    // Generate tiles (with metadata)
    let (tiles, metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)
        .map_err(|e| JsValue::from_str(&e))?;
    
    // Convert to Wasm data structure
    let tile_data: Vec<TileData> = tiles
        .into_iter()
        .map(|tile| TileData {
            path: tile.path,
            data: tile.data,
        })
        .collect();
    
    let metadata_data = MetadataData {
        min_zoom: metadata.min_zoom,
        max_zoom: metadata.max_zoom,
        layer_name: metadata.layer_name,
        bounds: metadata.bounds,
        center: metadata.center,
    };
    
    Ok(TileResult { 
        tiles: tile_data,
        metadata: metadata_data,
    })
}

/// Log output (for debugging)
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Output debug log (public for use within crate)
pub fn debug_log(message: &str) {
    log(message);
}

/// Output debug log (for Wasm bindgen)
#[wasm_bindgen]
pub fn wasm_debug_log(message: &str) {
    log(message);
}

/// Generate PMTiles archive from GeoJSON (for Wasm)
/// 
/// # Arguments
/// * `geojson_bytes` - GeoJSON byte array
/// * `min_zoom` - Minimum zoom level
/// * `max_zoom` - Maximum zoom level
/// * `layer_name` - Layer name
/// 
/// # Returns
/// * `Result<Vec<u8>, JsValue>` - PMTiles file data on success, error message on failure
#[wasm_bindgen]
pub fn generate_pmtiles_archive(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<Vec<u8>, JsValue> {
    debug_log(&format!("[Rust] Starting PMTiles generation: zoom {}-{}", min_zoom, max_zoom));
    
    // Generate tiles first to check count
    let (tile_files, metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)
        .map_err(|e| JsValue::from_str(&format!("Tile generation error: {}", e)))?;
    
    debug_log(&format!("[Rust] Generated {} tiles", tile_files.len()));
    
    // Convert to PMTiles format
    let tiles: Vec<(crate::TileCoord, Vec<u8>)> = tile_files
        .into_iter()
        .map(|tile_file| {
            let path_parts: Vec<&str> = tile_file.path.split('/').collect();
            if path_parts.len() == 3 {
                let z = path_parts[0].parse::<u8>().unwrap_or(0);
                let x = path_parts[1].parse::<u32>().unwrap_or(0);
                let y_pbf = path_parts[2];
                let y = y_pbf.trim_end_matches(".pbf").parse::<u32>().unwrap_or(0);
                (crate::TileCoord::new(z, x, y), tile_file.data)
            } else {
                (crate::TileCoord::new(0, 0, 0), tile_file.data)
            }
        })
        .collect();
    
    debug_log(&format!("[Rust] Encoding {} tiles into PMTiles format", tiles.len()));
    
    // Encode as PMTiles
    let pmtiles_data = crate::pmtiles_encoder::encode_pmtiles(tiles, &metadata)
        .map_err(|e| JsValue::from_str(&format!("PMTiles encoding error: {}", e)))?;
    
    debug_log(&format!("[Rust] PMTiles encoded: {} bytes", pmtiles_data.len()));
    
    Ok(pmtiles_data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_api_structure() {
        // Basic structure test
        let tile_data = vec![
            TileData {
                path: "0/0/0.pbf".to_string(),
                data: vec![1, 2, 3],
            },
        ];
        
        let result = TileResult { tiles: tile_data };
        assert_eq!(result.count(), 1);
        assert_eq!(result.get_path(0), Some("0/0/0.pbf".to_string()));
    }
}
