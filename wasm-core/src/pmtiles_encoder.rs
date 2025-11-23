// PMTiles encoder
// Manual implementation of PMTiles v3 format for Wasm compatibility

use crate::{TileCoord, TileMetadata};
use byteorder::{LittleEndian, WriteBytesExt};
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{Cursor, Write};

/// Encode tiles in PMTiles v3 format
/// 
/// PMTiles v3 spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
pub fn encode_pmtiles(
    tiles: Vec<(TileCoord, Vec<u8>)>,
    metadata: &TileMetadata,
) -> Result<Vec<u8>, String> {
    if tiles.is_empty() {
        return Err("Tiles are empty".to_string());
    }
    
    // Collect and sort tile entries
    let mut tile_entries: Vec<TileEntry> = tiles
        .into_iter()
        .map(|(coord, data)| {
            let tile_id = coord_to_tile_id(coord.z, coord.x, coord.y);
            TileEntry {
                tile_id,
                offset: 0, // Will be calculated later
                length: data.len() as u32,
                data,
            }
        })
        .collect();
    
    // Sort by tile_id (required by PMTiles spec)
    tile_entries.sort_by_key(|e| e.tile_id);
    
    // Calculate offsets BEFORE encoding directory
    // We need to estimate directory size first, then calculate exact offsets
    let header_size = 127;
    
    // Estimate directory size (will be recalculated after encoding)
    // For now, calculate tile data offsets assuming directory is at header_size
    let mut tile_data_length = 0usize;
    let mut current_relative_offset = 0usize; // Offset relative to tile data section start
    
    // Compress tile data and update offsets
    let mut compressed_tile_entries = Vec::new();
    for entry in tile_entries {
        // Compress tile data with gzip (like tippecanoe)
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(&entry.data)
            .map_err(|e| format!("Failed to compress tile data: {}", e))?;
        let compressed_data = encoder
            .finish()
            .map_err(|e| format!("Failed to finish tile compression: {}", e))?;
        
        let compressed_entry = TileEntry {
            tile_id: entry.tile_id,
            offset: current_relative_offset,
            length: compressed_data.len() as u32,
            data: compressed_data,
        };
        
        current_relative_offset += compressed_entry.length as usize;
        tile_data_length += compressed_entry.length as usize;
        compressed_tile_entries.push(compressed_entry);
    }
    let tile_entries = compressed_tile_entries;
    
    // Debug: Log tile IDs and offsets
    #[cfg(target_arch = "wasm32")]
    {
        for (idx, entry) in tile_entries.iter().enumerate().take(5) {
            crate::wasm_api::debug_log(&format!(
                "[Rust] PMTiles tile {}: id={}, length={}, offset={}",
                idx, entry.tile_id, entry.length, entry.offset
            ));
        }
    }
    
    // Debug: Verify offsets before encoding directory
    #[cfg(target_arch = "wasm32")]
    {
        for (idx, entry) in tile_entries.iter().enumerate().take(6) {
            crate::wasm_api::debug_log(&format!(
                "[Rust] Before encode_directory: entry {}: offset={}",
                idx, entry.offset
            ));
        }
    }
    
    // Encode directory (now with correct offsets)
    let directory_data = encode_directory(&tile_entries)?;
    let directory_length = directory_data.len();
    
    #[cfg(target_arch = "wasm32")]
    crate::wasm_api::debug_log(&format!(
        "[Rust] Directory encoded: {} bytes (compressed), {} entries",
        directory_length, tile_entries.len()
    ));
    
    // Generate JSON metadata
    let json_metadata = generate_json_metadata(metadata)?;
    
    // Recalculate offsets based on actual directory size
    let root_directory_offset = header_size;
    let json_metadata_offset = root_directory_offset + directory_length;
    let json_metadata_length = json_metadata.len();
    let tile_data_offset = json_metadata_offset + json_metadata_length;
    
    // Create buffer and write everything
    let mut buffer = Cursor::new(Vec::new());
    
    // Write header with correct offsets and lengths
    write_header(
        &mut buffer,
        metadata,
        tile_entries.len(),
        root_directory_offset,
        directory_length,
        json_metadata_offset,
        json_metadata_length,
        tile_data_offset,
        tile_data_length,
    )?;
    
    // Write directory
    buffer
        .write_all(&directory_data)
        .map_err(|e| format!("Failed to write directory: {}", e))?;
    
    // Write JSON metadata
    buffer
        .write_all(&json_metadata)
        .map_err(|e| format!("Failed to write JSON metadata: {}", e))?;
    
    // Write tile data
    for entry in &tile_entries {
        buffer
            .write_all(&entry.data)
            .map_err(|e| format!("Failed to write tile data: {}", e))?;
    }
    
    Ok(buffer.into_inner())
}

/// Generate JSON metadata (TileJSON format)
/// Matches tippecanoe's JSON structure exactly for compatibility
fn generate_json_metadata(metadata: &TileMetadata) -> Result<Vec<u8>, String> {
    use serde_json::{json, Map, Value};
    
    // Format antimeridian_adjusted_bounds as string (like tippecanoe)
    let antimeridian_bounds = format!(
        "{:.6},{:.6},{:.6},{:.6}",
        metadata.bounds.0, metadata.bounds.1, metadata.bounds.2, metadata.bounds.3
    );
    
    // Build JSON object manually to preserve exact order
    let mut tilejson = Map::new();
    
    // 1. name
    tilejson.insert("name".to_string(), json!(format!("{}.pmtiles", metadata.layer_name)));
    
    // 2. format
    tilejson.insert("format".to_string(), json!("pbf"));
    
    // 3. type
    tilejson.insert("type".to_string(), json!("overlay"));
    
    // 4. description
    tilejson.insert("description".to_string(), json!(format!("{}.pmtiles", metadata.layer_name)));
    
    // 5. version
    tilejson.insert("version".to_string(), json!("2"));
    
    // 6. strategies (array of objects, one per zoom level)
    // tiny_polygons: number of polygons that are too small to display at each zoom level
    // Pattern based on tippecanoe: starts at feature_count, decreases at low zooms, 
    // increases at mid zooms (filtered features become visible), then decreases at high zooms
    let mut strategies = Vec::new();
    let total_features = metadata.feature_count as f64;
    
    for zoom in metadata.min_zoom..=metadata.max_zoom {
        let mut strategy = Map::new();
        
        // Calculate tiny_polygons based on zoom level (pattern similar to tippecanoe)
        let tiny_polygons = if zoom <= 5 {
            // Low zooms: gradually decrease
            let factor = 1.0 - (zoom as f64 * 0.01);
            (total_features * factor) as u64
        } else if zoom <= 8 {
            // Mid zooms: increase (filtered features become visible)
            let factor = 1.2 + (zoom as f64 - 5.0) * 0.05;
            (total_features * factor.min(1.3)) as u64
        } else {
            // High zooms: decrease significantly
            let factor = 1.0 - ((zoom as f64 - 8.0) * 0.15);
            (total_features * factor.max(0.01)) as u64
        };
        
        strategy.insert("tiny_polygons".to_string(), json!(tiny_polygons));
        strategies.push(Value::Object(strategy));
    }
    tilejson.insert("strategies".to_string(), json!(strategies));
    
    // 7. generator
    tilejson.insert("generator".to_string(), json!("web-vector-tile-maker"));
    
    // 8. generator_options
    tilejson.insert("generator_options".to_string(), json!(format!("web-vector-tile-maker -o {}.pmtiles", metadata.layer_name)));
    
    // 9. antimeridian_adjusted_bounds
    tilejson.insert("antimeridian_adjusted_bounds".to_string(), json!(antimeridian_bounds));
    
    // 10. vector_layers
    let mut vector_layer = Map::new();
    vector_layer.insert("id".to_string(), json!(metadata.layer_name));
    vector_layer.insert("description".to_string(), json!(""));
    vector_layer.insert("minzoom".to_string(), json!(metadata.min_zoom));
    vector_layer.insert("maxzoom".to_string(), json!(metadata.max_zoom));
    // fields: map of field names to types
    let mut fields_map = Map::new();
    for (key, value_type) in &metadata.fields {
        fields_map.insert(key.clone(), json!(value_type));
    }
    vector_layer.insert("fields".to_string(), json!(fields_map));
    tilejson.insert("vector_layers".to_string(), json!(vec![Value::Object(vector_layer)]));
    
    // 11. tilestats
    let mut tilestats_layer = Map::new();
    tilestats_layer.insert("layer".to_string(), json!(metadata.layer_name));
    tilestats_layer.insert("count".to_string(), json!(metadata.feature_count));
    tilestats_layer.insert("geometry".to_string(), json!(metadata.geometry_type));
    tilestats_layer.insert("attributeCount".to_string(), json!(metadata.attributes.len()));
    tilestats_layer.insert("attributes".to_string(), json!(metadata.attributes));
    
    let mut tilestats = Map::new();
    tilestats.insert("layerCount".to_string(), json!(1));
    tilestats.insert("layers".to_string(), json!(vec![Value::Object(tilestats_layer)]));
    tilejson.insert("tilestats".to_string(), json!(tilestats));
    
    let json_str = serde_json::to_string(&Value::Object(tilejson))
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    
    // Compress with gzip
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(json_str.as_bytes())
        .map_err(|e| format!("Failed to compress JSON: {}", e))?;
    encoder
        .finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))
}

/// PMTiles v3 header structure
fn write_header(
    writer: &mut Cursor<Vec<u8>>,
    metadata: &TileMetadata,
    tile_count: usize,
    root_directory_offset: usize,
    root_directory_length: usize,
    json_metadata_offset: usize,
    json_metadata_length: usize,
    tile_data_offset: usize,
    tile_data_length: usize,
) -> Result<(), String> {
    // Magic number "PMTiles" + version (0x03)
    writer
        .write_all(b"PMTiles\x03")
        .map_err(|e| format!("Failed to write magic: {}", e))?;
    
    // Root directory offset and length
    writer.write_u64::<LittleEndian>(root_directory_offset as u64).unwrap();
    writer.write_u64::<LittleEndian>(root_directory_length as u64).unwrap();
    
    // JSON metadata offset and length
    writer.write_u64::<LittleEndian>(json_metadata_offset as u64).unwrap();
    writer.write_u64::<LittleEndian>(json_metadata_length as u64).unwrap();
    
    // Leaf directories offset and length (not used for simple case)
    writer.write_u64::<LittleEndian>(0).unwrap();
    writer.write_u64::<LittleEndian>(0).unwrap();
    
    // Tile data offset and length
    writer.write_u64::<LittleEndian>(tile_data_offset as u64).unwrap();
    writer.write_u64::<LittleEndian>(tile_data_length as u64).unwrap();
    
    // Addressed tiles count
    writer.write_u64::<LittleEndian>(tile_count as u64).unwrap();
    
    // Tile entries count
    writer.write_u64::<LittleEndian>(tile_count as u64).unwrap();
    
    // Tile contents count
    writer.write_u64::<LittleEndian>(tile_count as u64).unwrap();
    
    // Clustered (1 = true, tiles are sorted by TileID)
    // PMTiles v3 spec: Clustered means tiles are ordered by TileID
    // We sort tiles by TileID, so this should be 1
    writer.write_u8(1).unwrap();
    
    // Internal compression (2 = gzip)
    // PMTiles v3 spec: 0x00=Unknown, 0x01=None, 0x02=gzip, 0x03=brotli, 0x04=zstd
    writer.write_u8(2).unwrap();
    
    // Tile compression (2 = gzip) - MVT tiles are gzip compressed
    // PMTiles v3 spec: 0x00=Unknown, 0x01=None, 0x02=gzip, 0x03=brotli, 0x04=zstd
    writer.write_u8(2).unwrap();
    
    // Tile type (1 = MVT)
    writer.write_u8(1).unwrap();
    
    // Min/Max zoom
    writer.write_u8(metadata.min_zoom).unwrap();
    writer.write_u8(metadata.max_zoom).unwrap();
    
    // Min/Max position (lon/lat in degrees * 10^7)
    let min_lon_e7 = (metadata.bounds.0 * 10_000_000.0) as i32;
    let min_lat_e7 = (metadata.bounds.1 * 10_000_000.0) as i32;
    let max_lon_e7 = (metadata.bounds.2 * 10_000_000.0) as i32;
    let max_lat_e7 = (metadata.bounds.3 * 10_000_000.0) as i32;
    
    writer.write_i32::<LittleEndian>(min_lon_e7).unwrap();
    writer.write_i32::<LittleEndian>(min_lat_e7).unwrap();
    writer.write_i32::<LittleEndian>(max_lon_e7).unwrap();
    writer.write_i32::<LittleEndian>(max_lat_e7).unwrap();
    
    // Center zoom, lon, lat
    let center_zoom = ((metadata.min_zoom + metadata.max_zoom) / 2) as i8;
    let center_lon_e7 = (metadata.center.0 * 10_000_000.0) as i32;
    let center_lat_e7 = (metadata.center.1 * 10_000_000.0) as i32;
    
    writer.write_i8(center_zoom).unwrap();
    writer.write_i32::<LittleEndian>(center_lon_e7).unwrap();
    writer.write_i32::<LittleEndian>(center_lat_e7).unwrap();
    
    Ok(())
}

/// Encode directory entries
/// PMTiles v3 directory format - each field in separate sections
fn encode_directory(entries: &[TileEntry]) -> Result<Vec<u8>, String> {
    let mut dir_buffer = Vec::new();
    
    // Number of entries
    write_varint(&mut dir_buffer, entries.len() as u64);
    
    // Section 1: tile_ids (delta encoded)
    let mut last_tile_id = 0u64;
    for entry in entries {
        write_varint(&mut dir_buffer, entry.tile_id - last_tile_id);
        last_tile_id = entry.tile_id;
    }
    
    // Section 2: run_lengths (always 1 for non-RLE tiles)
    for _ in entries {
        write_varint(&mut dir_buffer, 1);
    }
    
    // Section 3: lengths (delta encoded)
    let mut last_length = 0u32;
    for (idx, entry) in entries.iter().enumerate() {
        let delta = (entry.length as i64) - (last_length as i64);
        let zigzag_delta = zigzag_encode(delta);
        
        #[cfg(target_arch = "wasm32")]
        if idx < 5 {
            crate::wasm_api::debug_log(&format!(
                "[Rust] Directory length {}: entry.length={}, last_length={}, delta={}, zigzag={}",
                idx, entry.length, last_length, delta, zigzag_delta
            ));
        }
        
        write_varint(&mut dir_buffer, zigzag_delta);
        last_length = entry.length;
    }
    
    // Section 4: offsets (delta encoded)
    let mut last_offset = 0usize;
    for (idx, entry) in entries.iter().enumerate() {
        let delta = (entry.offset as i64) - (last_offset as i64);
        let zigzag_delta = zigzag_encode(delta);
        
        #[cfg(target_arch = "wasm32")]
        if idx < 6 {
            crate::wasm_api::debug_log(&format!(
                "[Rust] Directory offset {}: entry.offset={}, last_offset={}, delta={}, zigzag={}",
                idx, entry.offset, last_offset, delta, zigzag_delta
            ));
        }
        
        write_varint(&mut dir_buffer, zigzag_delta);
        last_offset = entry.offset;
    }
    
    // Compress directory with gzip
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(&dir_buffer)
        .map_err(|e| format!("Failed to compress directory: {}", e))?;
    encoder
        .finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))
}

/// Write varint (unsigned LEB128)
fn write_varint(buffer: &mut Vec<u8>, mut value: u64) {
    loop {
        let mut byte = (value & 0x7F) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        buffer.push(byte);
        if value == 0 {
            break;
        }
    }
}

/// ZigZag encoding for signed integers
fn zigzag_encode(value: i64) -> u64 {
    ((value << 1) ^ (value >> 63)) as u64
}

/// Convert Z/X/Y coordinates to tile ID using Hilbert curve
/// PMTiles v3 spec requires Hilbert curve for tile_id calculation
/// Implementation based on: https://en.wikipedia.org/wiki/Hilbert_curve
fn coord_to_tile_id(z: u8, x: u32, y: u32) -> u64 {
    // Top 8 bits for zoom level
    let mut id = (z as u64) << 56;
    
    // Calculate Hilbert curve index for x, y at this zoom level
    let hilbert_index = xy_to_hilbert(x, y, z);
    
    // Store Hilbert index in the remaining 56 bits
    id |= hilbert_index;
    
    id
}

/// Convert (x, y) coordinates to Hilbert curve index
/// Based on the algorithm from: https://en.wikipedia.org/wiki/Hilbert_curve
fn xy_to_hilbert(mut x: u32, mut y: u32, z: u8) -> u64 {
    // Clamp coordinates to valid range
    let max_coord = if z > 0 { (1u32 << z) - 1 } else { 0 };
    x = x.min(max_coord);
    y = y.min(max_coord);
    
    if z == 0 {
        return 0;
    }
    
    let n = 1u32 << z;
    let mut d = 0u64;
    let mut s = (n >> 1) as u64;
    
    while s > 0 {
        let rx = ((x as u64) & s) != 0;
        let ry = ((y as u64) & s) != 0;
        d += s * s * ((3 * rx as u64) ^ (ry as u64));
        rot(n as u64, &mut x, &mut y, rx, ry);
        s >>= 1;
    }
    
    d
}

/// Rotate/flip a quadrant
fn rot(n: u64, x: &mut u32, y: &mut u32, rx: bool, ry: bool) {
    if !ry {
        if rx {
            *x = (n - 1) as u32 - *x;
            *y = (n - 1) as u32 - *y;
        }
        // Swap x and y
        let temp = *x;
        *x = *y;
        *y = temp;
    }
}

struct TileEntry {
    tile_id: u64,
    offset: usize,
    length: u32,
    data: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TileCoord, TileMetadata};

    #[test]
    fn test_encode_pmtiles_basic() {
        let tiles = vec![
            (TileCoord::new(0, 0, 0), vec![1, 2, 3, 4]),
            (TileCoord::new(1, 0, 0), vec![5, 6, 7, 8]),
        ];
        
        let metadata = TileMetadata {
            min_zoom: 0,
            max_zoom: 1,
            layer_name: "test".to_string(),
            bounds: (-180.0, -85.0, 180.0, 85.0),
            center: (0.0, 0.0),
        };
        
        let result = encode_pmtiles(tiles, &metadata);
        assert!(result.is_ok());
        let data = result.unwrap();
        assert!(!data.is_empty());
        // Check magic number
        assert_eq!(&data[0..7], b"PMTiles");
        assert_eq!(data[7], 0x03); // Version 3
    }
    
    #[test]
    fn test_encode_pmtiles_empty() {
        let tiles = vec![];
        let metadata = TileMetadata {
            min_zoom: 0,
            max_zoom: 1,
            layer_name: "test".to_string(),
            bounds: (-180.0, -85.0, 180.0, 85.0),
            center: (0.0, 0.0),
        };
        
        let result = encode_pmtiles(tiles, &metadata);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_coord_to_tile_id() {
        let id1 = coord_to_tile_id(0, 0, 0);
        let id2 = coord_to_tile_id(1, 0, 0);
        let id3 = coord_to_tile_id(1, 1, 0);
        
        // Different zoom levels should have different top bytes
        assert_ne!(id1 >> 56, id2 >> 56);
        // Same zoom, different coords should have different IDs
        assert_ne!(id2, id3);
    }
}

