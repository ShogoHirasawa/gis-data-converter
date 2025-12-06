// Vector Tile Core Library
// Rust implementation for generating vector tiles (.pbf) in the browser

pub mod geojson_parser;
pub mod projection;
pub mod tiler;
pub mod mvt_encoder;
pub mod pmtiles_encoder;

#[cfg(target_arch = "wasm32")]
pub mod wasm_api;

/// Tile coordinate structure
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TileCoord {
    pub z: u8,
    pub x: u32,
    pub y: u32,
}

impl TileCoord {
    pub fn new(z: u8, x: u32, y: u32) -> Self {
        Self { z, x, y }
    }
    
    pub fn to_path(&self) -> String {
        format!("{}/{}/{}.pbf", self.z, self.x, self.y)
    }
}

/// Tile file structure
#[derive(Debug, Clone)]
pub struct TileFile {
    pub path: String,
    pub data: Vec<u8>,
}

/// Tile metadata (for TileJSON generation)
#[derive(Debug, Clone)]
pub struct TileMetadata {
    pub min_zoom: u8,
    pub max_zoom: u8,
    pub layer_name: String,
    pub bounds: (f64, f64, f64, f64), // (min_lon, min_lat, max_lon, max_lat)
    pub center: (f64, f64),            // (center_lon, center_lat)
    pub feature_count: usize,          // Total number of features
    pub geometry_type: String,         // Most common geometry type: "Point", "LineString", or "Polygon"
    pub fields: std::collections::HashMap<String, String>, // Field name -> type mapping
    pub attributes: Vec<serde_json::Value>, // Attribute statistics
}

/// Analyze properties from features to extract fields and attributes
fn analyze_properties(features: &[geojson_parser::Feature]) -> (std::collections::HashMap<String, String>, Vec<serde_json::Value>) {
    use std::collections::{HashMap, HashSet};
    use serde_json::{json, Value};
    
    // Collect all field names and their types
    let mut field_types: HashMap<String, HashSet<String>> = HashMap::new();
    let mut field_values: HashMap<String, Vec<Value>> = HashMap::new();
    
    for feature in features {
        for (key, value) in &feature.properties {
            // Determine type
            let value_type = match value {
                Value::String(_) => "String",
                Value::Number(_) => "Number",
                Value::Bool(_) => "Boolean",
                Value::Null => "String", // null is treated as String in tippecanoe
                _ => "String",
            };
            
            field_types.entry(key.clone())
                .or_insert_with(HashSet::new)
                .insert(value_type.to_string());
            
            // Collect values (for statistics)
            field_values.entry(key.clone())
                .or_insert_with(Vec::new)
                .push(value.clone());
        }
    }
    
    // Build fields map (field name -> type)
    let mut fields = HashMap::new();
    for (key, types) in &field_types {
        // Use the most common type, or "String" if multiple types
        let field_type = if types.len() == 1 {
            types.iter().next().unwrap().clone()
        } else {
            "String".to_string()
        };
        fields.insert(key.clone(), field_type);
    }
    
    // Build attributes array (statistics for each field)
    let mut attributes = Vec::new();
    for (key, values) in &field_values {
        // Collect unique values (up to a limit)
        let mut unique_values = HashSet::new();
        for value in values {
            if let Some(s) = value.as_str() {
                unique_values.insert(s.to_string());
            } else if let Some(n) = value.as_f64() {
                unique_values.insert(n.to_string());
            } else if let Some(b) = value.as_bool() {
                unique_values.insert(b.to_string());
            } else if value.is_null() {
                unique_values.insert("null".to_string());
            }
        }
        
        // Limit to 100 unique values (like tippecanoe)
        let mut values_vec: Vec<String> = unique_values.into_iter().collect();
        values_vec.sort();
        if values_vec.len() > 100 {
            values_vec.truncate(100);
        }
        
        let field_type = fields.get(key).cloned().unwrap_or_else(|| "String".to_string());
        let attr_type = if field_type == "Number" { "number" } else { "string" };
        
        attributes.push(json!({
            "attribute": key,
            "count": values_vec.len().min(100),
            "type": attr_type,
            "values": values_vec
        }));
    }
    
    // Sort attributes by field name
    attributes.sort_by_key(|a| a["attribute"].as_str().unwrap_or("").to_string());
    
    (fields, attributes)
}

/// Main tile generation function (with metadata)
pub fn generate_tiles_with_metadata(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<(Vec<TileFile>, TileMetadata), String> {
    // 1. Parse GeoJSON
    let features = geojson_parser::parse_geojson(geojson_bytes)?;
    
    // 2. Calculate metadata
    let bounds = geojson_parser::calculate_bounds(&features)?;
    let center = geojson_parser::calculate_center(bounds);
    
    // Determine most common geometry type
    let mut point_count = 0;
    let mut linestring_count = 0;
    let mut polygon_count = 0;
    
    for feature in &features {
        match feature.geometry {
            geojson_parser::GeometryType::Point(_) => point_count += 1,
            geojson_parser::GeometryType::LineString(_) => linestring_count += 1,
            geojson_parser::GeometryType::Polygon(_) => polygon_count += 1,
        }
    }
    
    let geometry_type = if polygon_count >= point_count && polygon_count >= linestring_count {
        "Polygon".to_string()
    } else if linestring_count >= point_count {
        "LineString".to_string()
    } else {
        "Point".to_string()
    };
    
    // Analyze properties to extract fields and attributes
    let (fields, attributes) = analyze_properties(&features);
    
    let metadata = TileMetadata {
        min_zoom,
        max_zoom,
        layer_name: layer_name.to_string(),
        bounds,
        center,
        feature_count: features.len(),
        geometry_type,
        fields,
        attributes,
    };
    
    // 3. Generate tiles for each zoom level
    let mut tile_files = Vec::new();
    
    for zoom in min_zoom..=max_zoom {
        // 4. Assign features to tiles
        let tiles = tiler::tile_features(&features, zoom)?;
        
        // 5. Encode each tile in MVT format
        for (coord, features) in tiles {
            let mvt_data = mvt_encoder::encode_tile(&features, layer_name)?;
            tile_files.push(TileFile {
                path: coord.to_path(),
                data: mvt_data,
            });
        }
    }
    
    Ok((tile_files, metadata))
}

/// Main tile generation function (for backward compatibility)
pub fn generate_tiles(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<Vec<TileFile>, String> {
    let (tiles, _metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)?;
    Ok(tiles)
}

/// Generate PMTiles format (single file)
pub fn generate_pmtiles(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<Vec<u8>, String> {
    // Generate tiles with metadata
    let (tile_files, metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)?;
    
    // Convert TileFile to (TileCoord, Vec<u8>) format
    let tiles: Vec<(TileCoord, Vec<u8>)> = tile_files
        .into_iter()
        .map(|tile_file| {
            // Parse path to extract z/x/y coordinates
            let path_parts: Vec<&str> = tile_file.path.split('/').collect();
            if path_parts.len() == 3 {
                let z = path_parts[0].parse::<u8>().unwrap_or(0);
                let x = path_parts[1].parse::<u32>().unwrap_or(0);
                let y_pbf = path_parts[2];
                let y = y_pbf.trim_end_matches(".pbf").parse::<u32>().unwrap_or(0);
                (TileCoord::new(z, x, y), tile_file.data)
            } else {
                (TileCoord::new(0, 0, 0), tile_file.data)
            }
        })
        .collect();
    
    // Encode as PMTiles
    pmtiles_encoder::encode_pmtiles(tiles, &metadata)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_coord() {
        let coord = TileCoord::new(5, 10, 12);
        assert_eq!(coord.to_path(), "5/10/12.pbf");
    }
}
