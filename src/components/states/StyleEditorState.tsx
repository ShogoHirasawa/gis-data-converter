import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConversionResult, UploadedFile, ColorMode, CategoricalCategory, ContinuousStyle } from '../../types';
import { ChevronDown, Download, ArrowLeft, RefreshCw, Check } from 'lucide-react';
import maplibregl from 'maplibre-gl';
// Explicitly bundle the MapLibre worker to avoid runtime ReferenceError in production.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite worker import
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';
// Also expose worker URL for environments that ignore workerClass.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite worker url import
import MapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url';

// Force MapLibre to use the bundled worker (typings may not expose setWorkerClass).
const MLWorker = (MapLibreWorker as any).default ?? MapLibreWorker;
(maplibregl as any).setWorkerClass?.(MLWorker);
(maplibregl as any).workerClass = MLWorker;

// Fallback: set worker URL explicitly (MapLibre will fetch this if workerClass is ignored)
(maplibregl as any).setWorkerUrl?.(MapLibreWorkerUrl as string);
import 'maplibre-gl/dist/maplibre-gl.css';

interface StyleEditorStateProps {
  result: ConversionResult;
  uploadedFile: UploadedFile | null;
  onBack: () => void;
  onReset: () => void;
}

const StyleEditorState: React.FC<StyleEditorStateProps> = ({
  result,
  uploadedFile,
  onBack,
  onReset,
}) => {
  const { t } = useLanguage();

  // Gradient presets (lightest to darkest)
  const gradientPresets = {
    green: ['#F5F9F3', '#7FAD6F', '#4A7C3F'],
    blue: ['#F0F5FC', '#4A90E2', '#1E5FA8'],
    red: ['#FDF2F2', '#E24A4A', '#B81E1E'],
  };

  type GradientPresetKey = keyof typeof gradientPresets;
  type GradientSelection = GradientPresetKey | 'transparent';

  // Use first available property or empty string
  // GeoJSON text for preview (prefer cached; fallback to conversion result)
  const [geojsonText, setGeojsonText] = useState<string | null>(
    uploadedFile?.cachedGeoJSON || null
  );
  // Use first available property or empty string
  const initialProperty = result.featureInfo?.properties?.[0] || '';
  const [selectedProperty, setSelectedProperty] = useState<string>(initialProperty);
  const [colorMode, setColorMode] = useState<ColorMode>('categorical');
  const [selectedGradient, setSelectedGradient] = useState<GradientSelection>('green');
  const [categories, setCategories] = useState<CategoricalCategory[]>([]);
  const [continuousStyle, setContinuousStyle] = useState<ContinuousStyle>({
    minValue: 0,
    maxValue: 100000,
    gradientColors: gradientPresets.green,
  });
  const [circleStrokeColor, setCircleStrokeColor] = useState<string>('#FFFFFF');
  const [fillOutlineColor, setFillOutlineColor] = useState<string>('#7FAD6F');
  const [strokeWidth, setStrokeWidth] = useState<number>(1);

  // Infer geometry type if detection failed (fallback prevents polygons/lines from being treated as points)
  const inferGeometryTypeFromGeoJSON = useCallback((cachedGeoJSON?: string | null) => {
    if (!cachedGeoJSON) return 'unknown' as const;
    try {
      const geojson = JSON.parse(cachedGeoJSON);
      const types = new Set<string>();

      const normalize = (type: string) => {
        const normalized = type.toLowerCase();
        if (normalized === 'point' || normalized === 'multipoint') return 'point';
        if (normalized === 'linestring' || normalized === 'multilinestring') return 'line';
        if (normalized === 'polygon' || normalized === 'multipolygon') return 'polygon';
        return null;
      };

      const addType = (t: string | null) => {
        if (t) types.add(t);
      };

      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        for (const feature of geojson.features) {
          if (feature?.geometry?.type) addType(normalize(feature.geometry.type));
        }
      } else if (geojson.type === 'Feature' && geojson.geometry?.type) {
        addType(normalize(geojson.geometry.type));
      } else if (geojson.type && geojson.coordinates) {
        addType(normalize(geojson.type));
      }

      if (types.size === 0) return 'unknown' as const;
      if (types.size > 1) return 'mixed' as const;
      return Array.from(types)[0] as 'point' | 'line' | 'polygon';
    } catch (error) {
      console.warn('Failed to infer geometry type from cached GeoJSON:', error);
      return 'unknown' as const;
    }
  }, []);

  const geometryType = useMemo(() => {
    if (uploadedFile?.geometryType && uploadedFile.geometryType !== 'unknown') {
      return uploadedFile.geometryType;
    }

    const inferred = inferGeometryTypeFromGeoJSON(geojsonText);
    if (inferred === 'unknown') return 'mixed';
    return inferred;
  }, [uploadedFile?.geometryType, geojsonText, inferGeometryTypeFromGeoJSON]);
  
  // Load geojson text (fallback to conversion result blob when cached is missing)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (geojsonText) return;
      if (uploadedFile?.cachedGeoJSON) {
        setGeojsonText(uploadedFile.cachedGeoJSON);
        return;
      }
      if (result.format === 'geojson' && result.blob) {
        try {
          const text = await result.blob.text();
          if (!cancelled) setGeojsonText(text);
        } catch (e) {
          console.warn('Failed to read geojson from blob:', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geojsonText, uploadedFile?.cachedGeoJSON, result.format, result.blob]);
  
  // Use actual feature info if available, otherwise use empty data
  const featureCount = result.featureInfo?.featureCount ?? 0;
  const properties = result.featureInfo?.properties ?? [];
  const featureInfoError = result.featureInfoError;

  // Map container ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Calculate bounding box from GeoJSON
  const calculateBounds = (geojson: GeoJSON.FeatureCollection): maplibregl.LngLatBounds | null => {
    try {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      let hasCoordinates = false;

      // Iterative coordinate extraction to avoid stack overflow
      const extractCoordinates = (coords: any): void => {
        const stack: any[] = [coords];
        
        while (stack.length > 0) {
          const current = stack.pop();
          
          if (!Array.isArray(current)) {
            continue;
          }
          
          // Check if this is a coordinate pair [lng, lat]
          if (current.length >= 2 && 
              typeof current[0] === 'number' && 
              typeof current[1] === 'number') {
            const lng = current[0];
            const lat = current[1];
            
            // Validate coordinates
            if (isFinite(lng) && isFinite(lat) && 
                lng >= -180 && lng <= 180 && 
                lat >= -90 && lat <= 90) {
              minLng = Math.min(minLng, lng);
              minLat = Math.min(minLat, lat);
              maxLng = Math.max(maxLng, lng);
              maxLat = Math.max(maxLat, lat);
              hasCoordinates = true;
            }
          } else {
            // Push nested arrays to stack (in reverse order to maintain order)
            for (let i = current.length - 1; i >= 0; i--) {
              stack.push(current[i]);
            }
          }
        }
      };

      // Process each feature
      for (const feature of geojson.features) {
        if (!feature.geometry) {
          continue;
        }

        const geometry = feature.geometry;
        
        switch (geometry.type) {
          case 'Point':
            const point = geometry as GeoJSON.Point;
            if (point.coordinates && point.coordinates.length >= 2) {
              const [lng, lat] = point.coordinates;
              if (isFinite(lng) && isFinite(lat)) {
                minLng = Math.min(minLng, lng);
                minLat = Math.min(minLat, lat);
                maxLng = Math.max(maxLng, lng);
                maxLat = Math.max(maxLat, lat);
                hasCoordinates = true;
              }
            }
            break;
            
          case 'LineString':
          case 'MultiPoint':
            const coords1 = (geometry as GeoJSON.LineString | GeoJSON.MultiPoint).coordinates;
            extractCoordinates(coords1);
            break;
            
          case 'Polygon':
          case 'MultiLineString':
            const coords2 = (geometry as GeoJSON.Polygon | GeoJSON.MultiLineString).coordinates;
            extractCoordinates(coords2);
            break;
            
          case 'MultiPolygon':
            const coords3 = (geometry as GeoJSON.MultiPolygon).coordinates;
            extractCoordinates(coords3);
            break;
        }
      }

      if (!hasCoordinates) {
        return null;
      }

      return new maplibregl.LngLatBounds(
        [minLng, minLat],
        [maxLng, maxLat]
      );
    } catch (error) {
      console.error('Error calculating bounds:', error);
      return null;
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !uploadedFile?.cachedGeoJSON) {
      return;
    }

    try {
      if (!geojsonText) {
        console.error('GeoJSON not available for preview');
        return;
      }
      let geojson: GeoJSON.FeatureCollection;
      try {
        geojson = JSON.parse(geojsonText) as GeoJSON.FeatureCollection;
      } catch (parseError) {
        console.error('Error parsing GeoJSON:', parseError);
        return;
      }

      if (!geojson || !geojson.features || geojson.features.length === 0) {
        console.error('Invalid or empty GeoJSON');
        return;
      }
      
      // Calculate initial center and zoom from bounds
      const bounds = calculateBounds(geojson);
      let center: [number, number] = [0, 0];
      let zoom = 2;

      if (bounds) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        center = [
          (sw.lng + ne.lng) / 2,
          (sw.lat + ne.lat) / 2,
        ];
      }

      // OSM-based style definition
      const osmStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
          },
        ],
      };

      // Initialize map
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: osmStyle,
        center: center,
        zoom: zoom,
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapReady(true);
        // Add GeoJSON source
        map.addSource('geojson-source', {
          type: 'geojson',
          data: geojson,
        });

        // Add layer based on geometry type
        if (geometryType === 'point' || geometryType === 'mixed') {
          map.addLayer({
            id: 'geojson-layer',
            type: 'circle',
            source: 'geojson-source',
            paint: {
              'circle-radius': 6,
              'circle-color': '#7FAD6F',
              'circle-stroke-width': strokeWidth,
              'circle-stroke-color': circleStrokeColor,
            },
          });
        }

        if (geometryType === 'line' || geometryType === 'mixed') {
          map.addLayer({
            id: 'geojson-line-layer',
            type: 'line',
            source: 'geojson-source',
            paint: {
              'line-color': '#7FAD6F',
              'line-width': 2,
            },
          });
        }

        if (geometryType === 'polygon' || geometryType === 'mixed') {
          map.addLayer({
            id: 'geojson-fill-layer',
            type: 'fill',
            source: 'geojson-source',
            paint: {
              'fill-color': '#7FAD6F',
              'fill-opacity': 0.6,
            },
          });
          // lineレイヤーを追加してアウトラインとして使用
          map.addLayer({
            id: 'geojson-outline-layer',
            type: 'line',
            source: 'geojson-source',
            paint: {
              'line-color': fillOutlineColor,
              'line-width': strokeWidth,
            },
          });
        }

        // Fit bounds if available
        if (bounds) {
          map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
          });
        }

        // Add click event to show feature properties
        map.on('click', (e) => {
          // Build list of existing layers based on geometry type
          const availableLayers: string[] = [];
          if (geometryType === 'point' || geometryType === 'mixed') {
            availableLayers.push('geojson-layer');
          }
          if (geometryType === 'line' || geometryType === 'mixed') {
            availableLayers.push('geojson-line-layer');
          }
          if (geometryType === 'polygon' || geometryType === 'mixed') {
            availableLayers.push('geojson-fill-layer', 'geojson-outline-layer');
          }

          // Only query if there are available layers
          if (availableLayers.length === 0) {
            return;
          }

          const features = map.queryRenderedFeatures(e.point, {
            layers: availableLayers,
          });

          if (features.length > 0) {
            const feature = features[0];
            if (feature.properties) {
              const coordinates = (feature.geometry.type === 'Point'
                ? (feature.geometry as GeoJSON.Point).coordinates
                : e.lngLat.toArray()) as [number, number];

              // Ensure that if the map is zoomed out such that multiple
              // copies of the feature are visible, the popup appears
              // over the copy being pointed to.
              const lngLat = e.lngLat;
              while (Math.abs(lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += lngLat.lng > coordinates[0] ? 360 : -360;
              }

              // Create HTML content for popup
              const propertiesHTML = Object.entries(feature.properties)
                .map(([key, value]) => {
                  const displayValue = value !== null && value !== undefined ? String(value) : '-';
                  return `
                    <div style="padding: 8px 0; border-bottom: 1px solid #E2EBE0;">
                      <div style="font-weight: 600; color: #5A6A58; font-size: 12px; margin-bottom: 4px;">${key}</div>
                      <div style="color: #2A3A28; font-size: 14px;">${displayValue}</div>
                    </div>
                  `;
                })
                .join('');

              const popupHTML = `
                <div style="max-width: 300px; max-height: 400px; overflow-y: auto;">
                  <div style="max-height: 400px; overflow-y: auto;">
                    ${propertiesHTML}
                  </div>
                </div>
              `;

              // Remove existing popup if any
              if (popupRef.current) {
                popupRef.current.remove();
              }

              // Create and show popup
              const popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: false,
                className: 'custom-popup',
              })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);

              popupRef.current = popup;
            }
          }
        });

        // Change cursor on hover (only for existing layers)
        if (geometryType === 'point' || geometryType === 'mixed') {
          map.on('mouseenter', 'geojson-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'geojson-layer', () => {
            map.getCanvas().style.cursor = '';
          });
        }
        if (geometryType === 'line' || geometryType === 'mixed') {
          map.on('mouseenter', 'geojson-line-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'geojson-line-layer', () => {
            map.getCanvas().style.cursor = '';
          });
        }
        if (geometryType === 'polygon' || geometryType === 'mixed') {
          map.on('mouseenter', 'geojson-fill-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'geojson-fill-layer', () => {
            map.getCanvas().style.cursor = '';
          });
        }
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
      });

      return () => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        setMapReady(false);
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [uploadedFile?.cachedGeoJSON, geometryType]);

  // Helper function to check if a value can be converted to a number
  const isNumericValue = (value: any): boolean => {
    if (typeof value === 'number') {
      return isFinite(value);
    }
    if (typeof value === 'string') {
      // Check if string can be converted to a number
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && value.trim() !== '';
    }
    return false;
  };

  // Check if property values are all numeric (including string representations of numbers)
  const isNumericProperty = useCallback((property: string, geojson: GeoJSON.FeatureCollection): boolean => {
    if (!property) return false;
    
    let hasValues = false;
    for (const feature of geojson.features) {
      if (feature.properties && feature.properties[property] !== undefined && feature.properties[property] !== null) {
        hasValues = true;
        const value = feature.properties[property];
        // Check if value can be converted to a number (number type or string representation)
        if (!isNumericValue(value)) {
          return false;
        }
      }
    }
    return hasValues;
  }, []);

  // Extract min and max values from numeric property (including string representations of numbers)
  const extractMinMaxValues = useCallback((property: string, geojson: GeoJSON.FeatureCollection): { min: number, max: number } | null => {
    if (!property) return null;
    
    const numericValues: number[] = [];
    for (const feature of geojson.features) {
      if (feature.properties && feature.properties[property] !== undefined && feature.properties[property] !== null) {
        const value = feature.properties[property];
        // Convert to number if possible (handles both number type and string representation)
        if (typeof value === 'number' && isFinite(value)) {
          numericValues.push(value);
        } else if (typeof value === 'string') {
          const num = Number(value);
          if (!isNaN(num) && isFinite(num) && value.trim() !== '') {
            numericValues.push(num);
          }
        }
      }
    }
    
    if (numericValues.length === 0) {
      return null;
    }
    
    return {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
    };
  }, []);

  // Extract unique values from GeoJSON for selected property
  const extractCategories = useCallback((property: string): CategoricalCategory[] => {
    if (!uploadedFile?.cachedGeoJSON || !property) {
      return [];
    }

    try {
      const geojson = JSON.parse(uploadedFile.cachedGeoJSON) as GeoJSON.FeatureCollection;
      const uniqueValues = new Set<string>();
      
      // Collect unique values
      geojson.features.forEach((feature) => {
        if (feature.properties && feature.properties[property] !== undefined && feature.properties[property] !== null) {
          const value = feature.properties[property];
          // Convert to string for consistency
          const valueStr = String(value);
          uniqueValues.add(valueStr);
        }
      });

      // Convert to sorted array (no limit - display all)
      const sortedValues = Array.from(uniqueValues).sort();
      const displayValues = sortedValues;
      
      // If transparent is selected, set all colors to transparent
      if (selectedGradient === 'transparent') {
        return displayValues.map((value) => ({
          value,
          color: 'rgba(0, 0, 0, 0)',
          label: value,
        }));
      }
      
      // Generate colors from selected gradient
      const gradient = gradientPresets[selectedGradient];
      const colors = generateColorsFromGradient(gradient, displayValues.length);
      
      // Create categories
      return displayValues.map((value, index) => ({
        value,
        color: colors[index] || gradient[0],
        label: value,
      }));
    } catch (error) {
      console.error('Error extracting categories:', error);
      return [];
    }
  }, [uploadedFile?.cachedGeoJSON, selectedGradient]);

  // Extract categories when property or gradient changes (only for categorical mode)
  useEffect(() => {
    if (colorMode === 'categorical' && selectedProperty && uploadedFile?.cachedGeoJSON) {
      const extractedCategories = extractCategories(selectedProperty);
      setCategories(extractedCategories);
    }
  }, [selectedProperty, selectedGradient, colorMode, uploadedFile?.cachedGeoJSON, extractCategories]);

  // Update continuous style min/max values when property changes (only for continuous mode)
  useEffect(() => {
    if (colorMode === 'continuous' && selectedProperty && uploadedFile?.cachedGeoJSON) {
      try {
        const geojson = JSON.parse(uploadedFile.cachedGeoJSON) as GeoJSON.FeatureCollection;
        const isNumeric = isNumericProperty(selectedProperty, geojson);
        
        if (isNumeric) {
          const minMax = extractMinMaxValues(selectedProperty, geojson);
          if (minMax) {
            setContinuousStyle((prev) => ({
              ...prev,
              minValue: minMax.min,
              maxValue: minMax.max,
            }));
          }
        } else {
          // For non-numeric properties, set to null values (will display as "-")
          setContinuousStyle((prev) => ({
            ...prev,
            minValue: NaN,
            maxValue: NaN,
          }));
        }
      } catch (error) {
        console.error('Error updating continuous style:', error);
      }
    }
  }, [selectedProperty, colorMode, uploadedFile?.cachedGeoJSON, isNumericProperty, extractMinMaxValues]);

  // Update continuous style when gradient changes (only for continuous mode)
  useEffect(() => {
    if (colorMode === 'continuous') {
      if (selectedGradient === 'transparent') {
        setContinuousStyle((prev) => ({
          ...prev,
          gradientColors: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
        }));
      } else {
        setContinuousStyle((prev) => ({
          ...prev,
          gradientColors: gradientPresets[selectedGradient],
        }));
      }
    }
  }, [selectedGradient, colorMode]);

  // Update map style based on selected property and color mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedProperty || !map.getSource('geojson-source')) {
      return;
    }

    try {
      const getColorExpression = (): any => {
        if (colorMode === 'categorical') {
          // Build match expression for categorical colors
          const cases: any[] = [];
          categories.forEach((category) => {
            cases.push(category.value);
            cases.push(category.color);
          });
          cases.push('#CCCCCC'); // Default color
          
          return [
            'match',
            ['get', selectedProperty],
            ...cases,
          ];
        } else {
          // Build interpolate expression for continuous colors
          // Check if min/max values are valid (not NaN)
          if (isNaN(continuousStyle.minValue) || isNaN(continuousStyle.maxValue)) {
            // For non-numeric properties, return a default color
            return '#CCCCCC';
          }
          
          const stops: any[] = [];
          const numColors = continuousStyle.gradientColors.length;
          const range = continuousStyle.maxValue - continuousStyle.minValue;
          
          if (range === 0) {
            // If min and max are the same, use the first color
            return continuousStyle.gradientColors[0] || '#CCCCCC';
          }
          
          continuousStyle.gradientColors.forEach((color, index) => {
            const value = continuousStyle.minValue + (range * index) / (numColors - 1);
            stops.push(value);
            stops.push(color);
          });

          return [
            'interpolate',
            ['linear'],
            ['get', selectedProperty],
            ...stops,
          ];
        }
      };

      const colorExpression = getColorExpression();

      // Update layer styles based on geometry type
      if (geometryType === 'point' || geometryType === 'mixed') {
        if (map.getLayer('geojson-layer')) {
          map.setPaintProperty('geojson-layer', 'circle-color', colorExpression);
        }
      }

      if (geometryType === 'line' || geometryType === 'mixed') {
        if (map.getLayer('geojson-line-layer')) {
          map.setPaintProperty('geojson-line-layer', 'line-color', colorExpression);
        }
      }

      if (geometryType === 'polygon' || geometryType === 'mixed') {
        if (map.getLayer('geojson-fill-layer')) {
          map.setPaintProperty('geojson-fill-layer', 'fill-color', colorExpression);
        }
      }
    } catch (error) {
      console.error('Error updating map style:', error);
    }
  }, [selectedProperty, colorMode, categories, continuousStyle, geometryType, mapReady]);

  // Update stroke colors and width when they change
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    if (!map.loaded()) return;

    try {
      if (geometryType === 'point' || geometryType === 'mixed') {
        if (map.getLayer('geojson-layer')) {
          map.setPaintProperty('geojson-layer', 'circle-stroke-color', circleStrokeColor);
          map.setPaintProperty('geojson-layer', 'circle-stroke-width', strokeWidth);
        }
      }

      if (geometryType === 'polygon' || geometryType === 'mixed') {
        if (map.getLayer('geojson-outline-layer')) {
          map.setPaintProperty('geojson-outline-layer', 'line-color', fillOutlineColor);
          map.setPaintProperty('geojson-outline-layer', 'line-width', strokeWidth);
        }
      }
    } catch (error) {
      console.error('Error updating stroke colors and width:', error);
    }
  }, [circleStrokeColor, fillOutlineColor, strokeWidth, geometryType, mapReady]);

  // Generate colors from gradient
  const generateColorsFromGradient = (gradient: string[], count: number): string[] => {
    if (count === 0) return [];
    if (count === 1) return [gradient[0]];
    if (count <= gradient.length) {
      // If count is less than or equal to gradient length, use colors directly
      return gradient.slice(0, count);
    }
    
    // Interpolate colors for more categories
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const position = i / (count - 1); // 0 to 1
      const gradientIndex = position * (gradient.length - 1);
      const lowerIndex = Math.floor(gradientIndex);
      const upperIndex = Math.ceil(gradientIndex);
      const fraction = gradientIndex - lowerIndex;
      
      if (lowerIndex === upperIndex) {
        colors.push(gradient[lowerIndex]);
      } else {
        // Interpolate between two colors
        const lowerColor = gradient[lowerIndex];
        const upperColor = gradient[upperIndex];
        colors.push(interpolateColor(lowerColor, upperColor, fraction));
      }
    }
    return colors;
  };

  // Interpolate between two hex colors
  const interpolateColor = (color1: string, color2: string, fraction: number): string => {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    const r = Math.round(r1 + (r2 - r1) * fraction);
    const g = Math.round(g1 + (g2 - g1) * fraction);
    const b = Math.round(b1 + (b2 - b1) * fraction);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const handleCategoryColorChange = (index: number, color: string) => {
    const newCategories = [...categories];
    newCategories[index].color = color;
    setCategories(newCategories);
  };

  const handleExportMapLibre = () => {
    try {
      const isVectorTiles = result.format === 'pbf';
      const dataSourceId = isVectorTiles ? 'vector-tiles' : 'geojson-source';
      const sourceLayerName = isVectorTiles ? (result.pbfOptions?.layerName || 'layer') : undefined;
      // Default vector tile URL template (replace your_url with actual host)
      const tilesUrlTemplate = 'https://your_url/tiles_pbf/tiles/{z}/{x}/{y}.pbf';

      // Generate color expression (same logic as map preview)
      const getColorExpression = (): any => {
        if (!selectedProperty) {
          return '#CCCCCC';
        }

        if (colorMode === 'categorical') {
          if (categories.length === 0) {
            return '#CCCCCC';
          }

          // Build match expression for categorical colors
          const cases: any[] = [];
          categories.forEach((category) => {
            // Determine if value is numeric or string
            const isNumeric = !isNaN(Number(category.value)) && category.value !== '';
            const value = isNumeric ? Number(category.value) : category.value;
            cases.push(value);
            cases.push(category.color);
          });
          cases.push('#CCCCCC'); // Default color
          
          return [
            'match',
            ['get', selectedProperty],
            ...cases,
          ];
        } else {
          // Build interpolate expression for continuous colors
          // Check if min/max values are valid (not NaN)
          if (isNaN(continuousStyle.minValue) || isNaN(continuousStyle.maxValue)) {
            // For non-numeric properties, return a default color
            return '#CCCCCC';
          }
          
          const stops: any[] = [];
          const numColors = continuousStyle.gradientColors.length;
          const range = continuousStyle.maxValue - continuousStyle.minValue;
          
          if (range === 0) {
            // If min and max are the same, use the first color
            return continuousStyle.gradientColors[0] || '#CCCCCC';
          }
          
          continuousStyle.gradientColors.forEach((color, index) => {
            const value = continuousStyle.minValue + (range * index) / (numColors - 1);
            stops.push(value);
            stops.push(color);
          });

          return [
            'interpolate',
            ['linear'],
            ['get', selectedProperty],
            ...stops,
          ];
        }
      };

      const colorExpression = getColorExpression();
      const layers: any[] = [];

      // Point layer
      if (geometryType === 'point' || geometryType === 'mixed') {
        const pointLayer: any = {
          id: 'point-layer',
          type: 'circle',
          source: dataSourceId,
          paint: {
            'circle-color': colorExpression,
            'circle-radius': 6,
            'circle-stroke-color': circleStrokeColor,
            'circle-stroke-width': strokeWidth,
          },
        };
        if (isVectorTiles && sourceLayerName) {
          pointLayer['source-layer'] = sourceLayerName;
        }
        layers.push(pointLayer);
      }

      // Line layer
      if (geometryType === 'line' || geometryType === 'mixed') {
        const lineLayer: any = {
          id: 'line-layer',
          type: 'line',
          source: dataSourceId,
          paint: {
            'line-color': colorExpression,
            'line-width': 2,
          },
        };
        if (isVectorTiles && sourceLayerName) {
          lineLayer['source-layer'] = sourceLayerName;
        }
        layers.push(lineLayer);
      }

      // Polygon layer
      if (geometryType === 'polygon' || geometryType === 'mixed') {
        const fillLayer: any = {
          id: 'fill-layer',
          type: 'fill',
          source: dataSourceId,
          paint: {
            'fill-color': colorExpression,
            'fill-opacity': 0.6,
          },
        };
        if (isVectorTiles && sourceLayerName) {
          fillLayer['source-layer'] = sourceLayerName;
        }
        layers.push(fillLayer);
        
        // 枠線用のlineレイヤーを追加
        if (strokeWidth > 0 && fillOutlineColor !== 'rgba(0, 0, 0, 0)') {
          const outlineLayer: any = {
            id: 'outline-layer',
            type: 'line',
            source: dataSourceId,
            paint: {
              'line-color': fillOutlineColor,
              'line-width': strokeWidth,
            },
          };
          if (isVectorTiles && sourceLayerName) {
            outlineLayer['source-layer'] = sourceLayerName;
          }
          layers.push(outlineLayer);
        }
      }

      const style = {
        version: 8,
        name: 'Custom Style',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
          [dataSourceId]: isVectorTiles
            ? {
                type: 'vector',
                tiles: [tilesUrlTemplate],
                minzoom: result.pbfOptions?.minZoom ?? 0,
                maxzoom: result.pbfOptions?.maxZoom ?? 14,
              }
            : {
                type: 'geojson',
                data: uploadedFile?.cachedGeoJSON ? JSON.parse(uploadedFile.cachedGeoJSON) : {},
              },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
          },
          ...layers,
        ],
      };

      const blob = new Blob([JSON.stringify(style, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'style.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting MapLibre style:', error);
      alert('Failed to export MapLibre / Mapbox style.json');
    }
  };

  // Convert color to Re:Earth format (hex with alpha channel)
  const convertColorToReEarth = (color: string): string => {
    // Handle rgba(0, 0, 0, 0) format
    if (color === 'rgba(0, 0, 0, 0)') {
      return '#00000000';
    }
    
    // Handle rgba format
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
      const a = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 255).toString(16).padStart(2, '0') : 'ff';
      return `#${r}${g}${b}${a}`;
    }
    
    // Handle hex format (3 or 6 digits)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        // Expand #RGB to #RRGGBB
        const r = hex[0].repeat(2);
        const g = hex[1].repeat(2);
        const b = hex[2].repeat(2);
        return `#${r}${g}${b}ff`;
      } else if (hex.length === 6) {
        // Add alpha channel if not present
        return `#${hex}ff`;
      } else if (hex.length === 8) {
        // Already has alpha channel
        return color;
      }
    }
    
    // Default: return as is (shouldn't happen)
    return color;
  };

  // Generate Re:Earth style.json
  const generateReEarthStyle = (): any => {
    const style: any = {};

    // Helper function to create color expression
    const createColorExpression = (): any => {
      if (!selectedProperty) {
        return convertColorToReEarth('#CCCCCC');
      }

      if (colorMode === 'categorical') {
        if (categories.length === 0) {
          return convertColorToReEarth('#CCCCCC');
        }

        const conditions: any[] = [];
        categories.forEach((category) => {
          // Determine if value is numeric or string
          const isNumeric = !isNaN(Number(category.value)) && category.value !== '';
          const conditionValue = isNumeric 
            ? category.value 
            : `'${category.value}'`;
          const color = convertColorToReEarth(category.color);
          conditions.push([
            `\${${selectedProperty}} === ${conditionValue}`,
            `color('${color}')`
          ]);
        });
        
        // Add default color
        conditions.push(['true', `color('${convertColorToReEarth('#CCCCCC')}')`]);

        return {
          expression: {
            conditions
          }
        };
      } else {
        // Continuous mode
        if (isNaN(continuousStyle.minValue) || isNaN(continuousStyle.maxValue)) {
          return convertColorToReEarth('#CCCCCC');
        }

        const conditions: any[] = [];
        const numColors = continuousStyle.gradientColors.length;
        const range = continuousStyle.maxValue - continuousStyle.minValue;

        if (range === 0) {
          // If min and max are the same, use the first color
          return convertColorToReEarth(continuousStyle.gradientColors[0] || '#CCCCCC');
        }

        // Create conditions from highest to lowest value
        for (let i = numColors - 1; i >= 0; i--) {
          const value = continuousStyle.minValue + (range * i) / (numColors - 1);
          const color = convertColorToReEarth(continuousStyle.gradientColors[i]);
          conditions.push([
            `\${${selectedProperty}} >= ${value}`,
            `color('${color}')`
          ]);
        }

        // Add default color for values below minimum
        conditions.push(['true', `color('${convertColorToReEarth('#CCCCCC')}')`]);

        return {
          expression: {
            conditions
          }
        };
      }
    };

    const colorExpression = createColorExpression();
    const strokeColor = convertColorToReEarth(
      geometryType === 'point' ? circleStrokeColor : fillOutlineColor
    );

    // Generate style based on geometry type
    if (geometryType === 'point' || geometryType === 'mixed') {
      style.marker = {
        pointColor: colorExpression,
        pointOutlineColor: strokeColor === '#00000000' ? '#FFFFFF' : strokeColor,
        pointOutlineWidth: strokeWidth,
        pointSize: 12,
        style: 'point',
        heightReference: 'relative',
        hideIndicator: true,
      };
    }

    if (geometryType === 'line' || geometryType === 'mixed') {
      style.polyline = {
        strokeColor: colorExpression,
        strokeWidth: strokeWidth,
        clampToGround: true,
        hideIndicator: true,
      };
    }

    if (geometryType === 'polygon' || geometryType === 'mixed') {
      style.polygon = {
        fillColor: colorExpression,
        fill: true,
        stroke: strokeWidth > 0 && strokeColor !== '#00000000',
        strokeColor: strokeColor === '#00000000' ? '#CCCCCC' : strokeColor,
        strokeWidth: strokeWidth,
        heightReference: 'clamp',
        hideIndicator: true,
      };
    }

    return style;
  };

  const handleExportReEarth = () => {
    try {
      const reearthStyle = generateReEarthStyle();
      const blob = new Blob([JSON.stringify(reearthStyle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'style.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting Re:Earth style:', error);
      alert('Failed to export Re:Earth style.json');
    }
  };

  return (
    <div className="w-full flex" style={{ minHeight: '900px' }}>
      {/* Left Panel: Map Preview with Data Info */}
      <main
        className="flex-1 flex flex-col"
        style={{
          padding: '0 2rem',
        }}
      >
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-base font-medium transition hover:opacity-70 self-start"
          style={{ color: '#7FAD6F' }}
        >
          <ArrowLeft size={20} />
          <span>{t.back || 'Back'}</span>
        </button>

        {/* Data Information Card */}
        <div className="mb-4">
          <div
            className="p-4 rounded-[24px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            {/* Feature Count */}
            <div className="mb-4">
              <div
                className="mb-1 text-sm font-medium"
                style={{ color: '#5A6A58' }}
              >
                {t.featureCount || 'Feature Count'}
              </div>
              {featureInfoError ? (
                <div
                  className="text-sm"
                  style={{ color: '#D32F2F' }}
                >
                  {t.featureInfoError || 'Failed to load feature count'}
                </div>
              ) : (
                <div
                  className="text-base"
                  style={{ color: '#2A3A28' }}
                >
                  {featureCount.toLocaleString()} {t.other === 'その他' ? '件' : 'features'}
                </div>
              )}
            </div>

            {/* Available Properties */}
            <div>
              <div
                className="mb-2 text-sm font-medium"
                style={{ color: '#5A6A58' }}
              >
                {t.availableProperties || 'Available Properties'}
              </div>
              {featureInfoError ? (
                <div
                  className="text-sm"
                  style={{ color: '#D32F2F' }}
                >
                  {featureInfoError}
                </div>
              ) : properties.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {properties.map((prop) => (
                    <div
                      key={prop}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: '#F8FAF7',
                        color: '#2A3A28',
                      }}
                    >
                      {prop}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-sm"
                  style={{ color: '#5A6A58' }}
                >
                  {t.noProperties || 'No properties available'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Preview Notice */}
        <div className="mb-2">
          <div
            className="text-xs"
            style={{ color: '#8A9A88' }}
          >
            {t.mapPreviewNotice || 'Large data files may take time to display'}
          </div>
        </div>

        {/* Map Preview */}
        <div
          ref={mapContainerRef}
          className="rounded-[32px] relative"
          style={{
            backgroundColor: '#F0F5EE',
            boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            height: '650px',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          {!uploadedFile?.cachedGeoJSON && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div
                  className="text-lg font-medium mb-2"
                  style={{ color: '#5A6A58' }}
                >
                  {t.mapPreviewArea || 'Map preview area'}
                </div>
                <div
                  className="text-sm"
                  style={{ color: '#8A9A88' }}
                >
                  {t.noProperties || 'No data available'}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Panel: Style Settings */}
      <aside
        className="flex-shrink-0"
        style={{
          width: '24rem',
          padding: '1.5rem',
        }}
      >
        <h2
          className="mb-6 text-xl font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.styleSettings || 'Style Settings'}
        </h2>

        {/* Section 1: Property Selector */}
        <div className="mb-8">
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.selectProperty || '1. Select the property to use for coloring'}
            </h3>
            <div
              className="relative flex items-center gap-3 px-5 py-3 rounded-full border cursor-pointer hover:border-[#C8D8C5] transition"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2EBE0',
              }}
            >
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="flex-1 appearance-none bg-transparent border-none outline-none cursor-pointer"
                style={{ color: '#2A3A28' }}
                disabled={properties.length === 0}
              >
                {properties.length > 0 ? (
                  properties.map((prop) => (
                    <option key={prop} value={prop}>
                      {prop}
                    </option>
                  ))
                ) : (
                  <option value="">{t.noProperties || 'No properties available'}</option>
                )}
              </select>
              <ChevronDown size={16} style={{ color: '#8A9A88' }} />
            </div>
          </div>
        </div>

        {/* Section 2: Color Mode Selector */}
        <div className="mb-8">
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.selectColorMode || '2. Select how to apply colors'}
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="categorical"
                  checked={colorMode === 'categorical'}
                  onChange={(e) => setColorMode(e.target.value as ColorMode)}
                  className="sr-only"
                />
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full"
                  style={{
                    backgroundColor: colorMode === 'categorical' ? '#E8F3E4' : '#E8F3E4',
                  }}
                >
                  {colorMode === 'categorical' && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: '#7FAD6F' }}
                    />
                  )}
                </div>
                <span
                  className="text-base"
                  style={{ color: '#2A3A28' }}
                >
                  {t.categoricalMode || 'Color by category'}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="continuous"
                  checked={colorMode === 'continuous'}
                  onChange={(e) => setColorMode(e.target.value as ColorMode)}
                  className="sr-only"
                />
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full"
                  style={{
                    backgroundColor: colorMode === 'continuous' ? '#E8F3E4' : '#E8F3E4',
                  }}
                >
                  {colorMode === 'continuous' && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: '#7FAD6F' }}
                    />
                  )}
                </div>
                <span
                  className="text-base"
                  style={{ color: '#2A3A28' }}
                >
                  {t.continuousMode || 'Gradient by value'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Style Details */}
        <div className="mb-8">
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.styleDetails || '3. Set color details'}
            </h3>

            {colorMode === 'categorical' ? (
              <div className="space-y-4">
                <div>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.selectGradient || 'Select Gradient'}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {(Object.keys(gradientPresets) as GradientPresetKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setSelectedGradient(key)}
                        className="px-4 py-2 rounded-full text-sm border transition whitespace-nowrap flex-shrink-0"
                        style={{
                          backgroundColor: selectedGradient === key ? '#E8F3E4' : '#F8FAF7',
                          borderColor: selectedGradient === key ? '#7FAD6F' : '#C8D8C5',
                          color: '#2A3A28',
                          fontWeight: selectedGradient === key ? '600' : '400',
                        }}
                      >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedGradient('transparent')}
                      className="px-4 py-2 rounded-full text-sm border transition flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                      style={{
                        backgroundColor: selectedGradient === 'transparent' ? '#E8F3E4' : '#F8FAF7',
                        borderColor: selectedGradient === 'transparent' ? '#7FAD6F' : '#C8D8C5',
                        color: '#2A3A28',
                        fontWeight: selectedGradient === 'transparent' ? '600' : '400',
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded border flex-shrink-0"
                        style={{
                          backgroundImage: 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                        }}
                      />
                      {t.transparent || 'Transparent'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {categories.length === 0 ? (
                    <div
                      className="text-sm text-center py-4"
                      style={{ color: '#8A9A88' }}
                    >
                      {t.noCategories || 'No categories found'}
                    </div>
                  ) : (
                    categories.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-3 rounded-2xl"
                      style={{ backgroundColor: '#F8FAF7' }}
                    >
                      <span
                        className="text-sm"
                        style={{ color: '#2A3A28' }}
                      >
                        {category.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCategoryColorChange(index, 'rgba(0, 0, 0, 0)')}
                          className="relative w-6 h-6 rounded border flex items-center justify-center transition"
                          style={{
                            borderColor: category.color === 'rgba(0, 0, 0, 0)' ? '#7FAD6F' : '#C8D8C5',
                            backgroundColor: category.color === 'rgba(0, 0, 0, 0)' ? '#E8F3E4' : '#FFFFFF',
                          }}
                          title={t.transparent || 'Transparent'}
                        >
                          {category.color === 'rgba(0, 0, 0, 0)' ? (
                            <Check size={14} style={{ color: '#7FAD6F' }} />
                          ) : (
                            <div
                              className="w-4 h-4 rounded"
                              style={{
                                background: 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                              }}
                            />
                          )}
                        </button>
                        <input
                          type="color"
                          value={category.color === 'rgba(0, 0, 0, 0)' ? '#FFFFFF' : category.color}
                          onChange={(e) => handleCategoryColorChange(index, e.target.value)}
                          className="w-6 h-6 rounded border cursor-pointer"
                          style={{ borderColor: '#C8D8C5' }}
                        />
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.minValue || 'Min Value'}: {!isNaN(continuousStyle.minValue) ? continuousStyle.minValue.toLocaleString() : '-'}
                  </div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.maxValue || 'Max Value'}: {!isNaN(continuousStyle.maxValue) ? continuousStyle.maxValue.toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.selectGradient || 'Select Gradient'}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {(Object.keys(gradientPresets) as GradientPresetKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setSelectedGradient(key)}
                        className="px-4 py-2 rounded-full text-sm border transition whitespace-nowrap flex-shrink-0"
                        style={{
                          backgroundColor: selectedGradient === key ? '#E8F3E4' : '#F8FAF7',
                          borderColor: selectedGradient === key ? '#7FAD6F' : '#C8D8C5',
                          color: '#2A3A28',
                          fontWeight: selectedGradient === key ? '600' : '400',
                        }}
                      >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedGradient('transparent')}
                      className="px-4 py-2 rounded-full text-sm border transition flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                      style={{
                        backgroundColor: selectedGradient === 'transparent' ? '#E8F3E4' : '#F8FAF7',
                        borderColor: selectedGradient === 'transparent' ? '#7FAD6F' : '#C8D8C5',
                        color: '#2A3A28',
                        fontWeight: selectedGradient === 'transparent' ? '600' : '400',
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded border flex-shrink-0"
                        style={{
                          backgroundImage: 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                        }}
                      />
                      {t.transparent || 'Transparent'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Stroke Color and Width Settings */}
        {(geometryType === 'point' || geometryType === 'mixed' || geometryType === 'polygon') && (
          <div className="mb-8">
            <div
              className="p-6 rounded-[32px]"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
              }}
            >
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ color: '#2A3A28' }}
              >
                {t.strokeColorAndWidth || '4. Set stroke color and width'}
              </h3>
              <div
                className="mb-4 text-sm"
                style={{ color: '#5A6A58' }}
              >
                {t.strokeColorAndWidthDescription || 'Set the stroke color and width for points and polygons'}
              </div>
              
              {/* Stroke Width Slider */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.strokeWidth || 'Stroke width'}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: '#2A3A28' }}
                  >
                    {strokeWidth}px
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: '#E8F3E4',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="space-y-4">
                {(geometryType === 'point' || geometryType === 'mixed') && (
                  <div>
                    <div
                      className="mb-2 text-sm font-medium"
                      style={{ color: '#5A6A58' }}
                    >
                      {t.circleStrokeColor || 'Point stroke color'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCircleStrokeColor('rgba(0, 0, 0, 0)')}
                        className="relative w-6 h-6 rounded border flex items-center justify-center transition"
                        style={{
                          borderColor: circleStrokeColor === 'rgba(0, 0, 0, 0)' ? '#7FAD6F' : '#C8D8C5',
                          backgroundColor: circleStrokeColor === 'rgba(0, 0, 0, 0)' ? '#E8F3E4' : '#FFFFFF',
                        }}
                        title={t.transparent || 'Transparent'}
                      >
                        {circleStrokeColor === 'rgba(0, 0, 0, 0)' ? (
                          <Check size={14} style={{ color: '#7FAD6F' }} />
                        ) : (
                          <div
                            className="w-4 h-4 rounded"
                            style={{
                              background: 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                            }}
                          />
                        )}
                      </button>
                      <input
                        type="color"
                        value={circleStrokeColor === 'rgba(0, 0, 0, 0)' ? '#FFFFFF' : circleStrokeColor}
                        onChange={(e) => setCircleStrokeColor(e.target.value)}
                        className="w-6 h-6 rounded border cursor-pointer"
                        style={{ borderColor: '#C8D8C5' }}
                      />
                      <div
                        className="w-8 h-8 rounded border flex items-center justify-center"
                        style={{
                          backgroundColor: circleStrokeColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : circleStrokeColor,
                          borderColor: '#C8D8C5',
                          backgroundImage: circleStrokeColor === 'rgba(0, 0, 0, 0)' 
                            ? 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px'
                            : 'none',
                        }}
                      />
                    </div>
                  </div>
                )}
                {(geometryType === 'polygon' || geometryType === 'mixed') && (
                  <div>
                    <div
                      className="mb-2 text-sm font-medium"
                      style={{ color: '#5A6A58' }}
                    >
                      {t.fillOutlineColor || 'Polygon outline color'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFillOutlineColor('rgba(0, 0, 0, 0)')}
                        className="relative w-6 h-6 rounded border flex items-center justify-center transition"
                        style={{
                          borderColor: fillOutlineColor === 'rgba(0, 0, 0, 0)' ? '#7FAD6F' : '#C8D8C5',
                          backgroundColor: fillOutlineColor === 'rgba(0, 0, 0, 0)' ? '#E8F3E4' : '#FFFFFF',
                        }}
                        title={t.transparent || 'Transparent'}
                      >
                        {fillOutlineColor === 'rgba(0, 0, 0, 0)' ? (
                          <Check size={14} style={{ color: '#7FAD6F' }} />
                        ) : (
                          <div
                            className="w-4 h-4 rounded"
                            style={{
                              background: 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px',
                            }}
                          />
                        )}
                      </button>
                      <input
                        type="color"
                        value={fillOutlineColor === 'rgba(0, 0, 0, 0)' ? '#FFFFFF' : fillOutlineColor}
                        onChange={(e) => setFillOutlineColor(e.target.value)}
                        className="w-6 h-6 rounded border cursor-pointer"
                        style={{ borderColor: '#C8D8C5' }}
                      />
                      <div
                        className="w-8 h-8 rounded border flex items-center justify-center"
                        style={{
                          backgroundColor: fillOutlineColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : fillOutlineColor,
                          borderColor: '#C8D8C5',
                          backgroundImage: fillOutlineColor === 'rgba(0, 0, 0, 0)' 
                            ? 'repeating-conic-gradient(#C8D8C5 0% 25%, transparent 0% 50%) 50% / 4px 4px'
                            : 'none',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Legend Preview */}
        <div className="mb-8">
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <h3
              className="mb-4 text-lg font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.legendPreview || 'Legend'}
            </h3>
            <div 
              className={`space-y-2 ${colorMode === 'categorical' && categories.length > 10 ? 'max-h-64 overflow-y-auto' : ''}`}
            >
              {colorMode === 'categorical' ? (
                categories.map((category, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: '#2A3A28' }}
                    >
                      {category.label}
                    </span>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-full h-4 rounded"
                      style={{
                        background: `linear-gradient(to right, ${continuousStyle.gradientColors.join(', ')})`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: '#5A6A58' }}>
                    <span>{!isNaN(continuousStyle.minValue) ? continuousStyle.minValue.toLocaleString() : '-'}</span>
                    <span>{!isNaN(continuousStyle.maxValue) ? continuousStyle.maxValue.toLocaleString() : '-'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: Export Buttons */}
        <div>
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <div className="mb-4">
              <div
                className="mb-2 text-sm font-medium"
                style={{ color: '#5A6A58' }}
              >
                {t.currentSettings || 'Current Settings'}
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleExportMapLibre}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold transition hover:bg-[#6B9A5B]"
                style={{
                  backgroundColor: '#7FAD6F',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
                }}
              >
                <Download size={16} />
                <span>{t.exportMapLibre || 'Export MapLibre / Mapbox style.json'}</span>
              </button>
              <button
                onClick={handleExportReEarth}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold border transition hover:bg-[#F8FAF7]"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#7FAD6F',
                  borderColor: '#C8D8C5',
                }}
              >
                <Download size={16} />
                <span>{t.exportReEarth || 'Export Re:Earth style.json'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Convert New File */}
        <div className="mt-8">
          <div
            className="p-6 rounded-[32px]"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            }}
          >
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold border transition hover:bg-[#F8FAF7]"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#7FAD6F',
                borderColor: '#C8D8C5',
              }}
            >
              <RefreshCw size={16} />
              <span>{t.convertNew || 'Convert New File'}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StyleEditorState;

