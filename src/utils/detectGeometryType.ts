/**
 * Geometry type detection utility
 * Detects geometry type (point, line, polygon) from geospatial data
 */

import { InputFormat } from './detectFormat';
import { GeometryType } from '../types';
import { shapefileToGeoJSON } from './conversions/shapefile';
import { kmlToGeoJSON } from './conversions/kml';

/**
 * Result of geometry type detection
 */
export interface GeometryDetectionResult {
  geometryType: GeometryType;
  cachedGeoJSON?: string; // Cached GeoJSON if conversion was performed
}

/**
 * Detect geometry type from file
 * Returns both geometry type and optionally cached GeoJSON for formats that require conversion
 */
export async function detectGeometryType(
  file: File | ArrayBuffer,
  format: InputFormat
): Promise<GeometryDetectionResult> {
  let buffer: ArrayBuffer;
  
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  try {
    switch (format) {
      case 'geojson':
        return {
          geometryType: detectGeometryTypeFromGeoJSON(buffer),
          cachedGeoJSON: new TextDecoder('utf-8', { fatal: false }).decode(buffer),
        };
      case 'kml':
        return await detectGeometryTypeFromKML(buffer);
      case 'csv':
        return { geometryType: 'point' }; // CSV always contains point data
      case 'shapefile':
        return await detectGeometryTypeFromShapefile(buffer);
      case 'gpx':
        // GPX is not fully supported, but if we need to support it in the future
        // we can convert to GeoJSON first
        return { geometryType: 'unknown' };
      default:
        return { geometryType: 'unknown' };
    }
  } catch (error) {
    console.error('Error detecting geometry type:', error);
    return { geometryType: 'unknown' };
  }
}

/**
 * Detect geometry type from GeoJSON
 */
function detectGeometryTypeFromGeoJSON(buffer: ArrayBuffer): GeometryType {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const geojson = JSON.parse(text);

    return analyzeGeoJSONGeometry(geojson);
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Detect geometry type from KML (via GeoJSON conversion)
 */
async function detectGeometryTypeFromKML(buffer: ArrayBuffer): Promise<GeometryDetectionResult> {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const geojsonText = kmlToGeoJSON(text);
    const geojson = JSON.parse(geojsonText);
    
    return {
      geometryType: analyzeGeoJSONGeometry(geojson),
      cachedGeoJSON: geojsonText,
    };
  } catch (error) {
    return { geometryType: 'unknown' };
  }
}

/**
 * Detect geometry type from Shapefile (via GeoJSON conversion)
 */
async function detectGeometryTypeFromShapefile(buffer: ArrayBuffer): Promise<GeometryDetectionResult> {
  try {
    const geojsonText = await shapefileToGeoJSON(buffer);
    const geojson = JSON.parse(geojsonText);
    
    return {
      geometryType: analyzeGeoJSONGeometry(geojson),
      cachedGeoJSON: geojsonText,
    };
  } catch (error) {
    return { geometryType: 'unknown' };
  }
}

/**
 * Analyze GeoJSON to determine geometry type
 */
function analyzeGeoJSONGeometry(geojson: any): GeometryType {
  const geometryTypes = new Set<string>();

  // Handle FeatureCollection
  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    for (const feature of geojson.features) {
      if (feature.geometry) {
        const type = normalizeGeometryType(feature.geometry.type);
        if (type) {
          geometryTypes.add(type);
        }
      }
    }
  }
  // Handle single Feature
  else if (geojson.type === 'Feature' && geojson.geometry) {
    const type = normalizeGeometryType(geojson.geometry.type);
    if (type) {
      geometryTypes.add(type);
    }
  }
  // Handle Geometry object
  else if (geojson.type && geojson.coordinates) {
    const type = normalizeGeometryType(geojson.type);
    if (type) {
      geometryTypes.add(type);
    }
  }

  if (geometryTypes.size === 0) {
    return 'unknown';
  }

  if (geometryTypes.size > 1) {
    return 'mixed';
  }

  const type = Array.from(geometryTypes)[0];
  return type as GeometryType;
}

/**
 * Normalize geometry type to point, line, or polygon
 */
function normalizeGeometryType(type: string): 'point' | 'line' | 'polygon' | null {
  const normalized = type.toLowerCase();
  
  if (normalized === 'point' || normalized === 'multipoint') {
    return 'point';
  }
  
  if (normalized === 'linestring' || normalized === 'multilinestring') {
    return 'line';
  }
  
  if (normalized === 'polygon' || normalized === 'multipolygon') {
    return 'polygon';
  }
  
  return null;
}

