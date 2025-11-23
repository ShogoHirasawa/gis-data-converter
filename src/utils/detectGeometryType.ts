/**
 * Geometry type detection utility
 * Detects geometry type (point, line, polygon) from geospatial data
 */

import { InputFormat } from './detectFormat';
import { GeometryType } from '../types';
import { shapefileToGeoJSON } from './conversions/shapefile';
import { kmlToGeoJSON } from './conversions/kml';

/**
 * Detect geometry type from file
 */
export async function detectGeometryType(
  file: File | ArrayBuffer,
  format: InputFormat,
  fileName?: string
): Promise<GeometryType> {
  let buffer: ArrayBuffer;
  
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  try {
    switch (format) {
      case 'geojson':
        return detectGeometryTypeFromGeoJSON(buffer);
      case 'kml':
        return await detectGeometryTypeFromKML(buffer);
      case 'csv':
        return 'point'; // CSV always contains point data
      case 'shapefile':
        return await detectGeometryTypeFromShapefile(buffer);
      case 'gpx':
        // GPX is not fully supported, but if we need to support it in the future
        // we can convert to GeoJSON first
        return 'unknown';
      default:
        return 'unknown';
    }
  } catch (error) {
    console.error('Error detecting geometry type:', error);
    return 'unknown';
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
async function detectGeometryTypeFromKML(buffer: ArrayBuffer): Promise<GeometryType> {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const geojsonText = kmlToGeoJSON(text);
    const geojson = JSON.parse(geojsonText);
    
    return analyzeGeoJSONGeometry(geojson);
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Detect geometry type from Shapefile (via GeoJSON conversion)
 */
async function detectGeometryTypeFromShapefile(buffer: ArrayBuffer): Promise<GeometryType> {
  try {
    const geojsonText = await shapefileToGeoJSON(buffer);
    const geojson = JSON.parse(geojsonText);
    
    return analyzeGeoJSONGeometry(geojson);
  } catch (error) {
    return 'unknown';
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

