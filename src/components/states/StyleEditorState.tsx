import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConversionResult, UploadedFile, ColorMode, CategoricalCategory, ContinuousStyle } from '../../types';
import { ChevronDown, Download, ArrowLeft, RefreshCw } from 'lucide-react';
import maplibregl from 'maplibre-gl';
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

  // Use first available property or empty string
  const initialProperty = result.featureInfo?.properties?.[0] || '';
  const [selectedProperty, setSelectedProperty] = useState<string>(initialProperty);
  const [colorMode, setColorMode] = useState<ColorMode>('categorical');
  const [categories, setCategories] = useState<CategoricalCategory[]>([
    { value: '東京都', color: '#7FAD6F', label: '東京都' },
    { value: '大阪府', color: '#A3C595', label: '大阪府' },
    { value: '愛知県', color: '#D9B88F', label: '愛知県' },
    { value: '福岡県', color: '#8BAAA5', label: '福岡県' },
    { value: 'その他', color: '#B8A99A', label: 'その他' },
  ]);
  const [continuousStyle] = useState<ContinuousStyle>({
    minValue: 0,
    maxValue: 100000,
    gradientColors: ['#7FAD6F', '#A3C595', '#D9B88F'],
  });

  const geometryType = uploadedFile?.geometryType || 'point';
  
  // Use actual feature info if available, otherwise use empty data
  const featureCount = result.featureInfo?.featureCount ?? 0;
  const properties = result.featureInfo?.properties ?? [];
  const featureInfoError = result.featureInfoError;

  // Map container ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Calculate bounding box from GeoJSON
  const calculateBounds = (geojson: GeoJSON.FeatureCollection): maplibregl.LngLatBounds | null => {
    try {
      const coordinates: number[][] = [];
      
      const collectCoordinates = (coords: any) => {
        if (Array.isArray(coords[0])) {
          coords.forEach((coord: any) => collectCoordinates(coord));
        } else if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          coordinates.push([coords[0], coords[1]]);
        }
      };

      geojson.features.forEach((feature) => {
        if (feature.geometry) {
          if (feature.geometry.type === 'Point') {
            const point = feature.geometry as GeoJSON.Point;
            coordinates.push(point.coordinates as [number, number]);
          } else if (feature.geometry.type === 'LineString') {
            const line = feature.geometry as GeoJSON.LineString;
            collectCoordinates(line.coordinates);
          } else if (feature.geometry.type === 'Polygon') {
            const polygon = feature.geometry as GeoJSON.Polygon;
            collectCoordinates(polygon.coordinates);
          } else if (feature.geometry.type === 'MultiPoint') {
            const multiPoint = feature.geometry as GeoJSON.MultiPoint;
            collectCoordinates(multiPoint.coordinates);
          } else if (feature.geometry.type === 'MultiLineString') {
            const multiLine = feature.geometry as GeoJSON.MultiLineString;
            collectCoordinates(multiLine.coordinates);
          } else if (feature.geometry.type === 'MultiPolygon') {
            const multiPolygon = feature.geometry as GeoJSON.MultiPolygon;
            collectCoordinates(multiPolygon.coordinates);
          }
        }
      });

      if (coordinates.length === 0) {
        return null;
      }

      const lngs = coordinates.map((c) => c[0]);
      const lats = coordinates.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

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
      let geojson: GeoJSON.FeatureCollection;
      try {
        geojson = JSON.parse(uploadedFile.cachedGeoJSON) as GeoJSON.FeatureCollection;
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
              'circle-stroke-width': 1,
              'circle-stroke-color': '#FFFFFF',
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
          map.addLayer({
            id: 'geojson-outline-layer',
            type: 'line',
            source: 'geojson-source',
            paint: {
              'line-color': '#7FAD6F',
              'line-width': 1,
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
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <h3 style="font-size: 18px; font-weight: 600; color: #2A3A28; margin: 0;">${t.featureProperties || 'Feature Properties'}</h3>
                  </div>
                  <div style="max-height: 350px; overflow-y: auto;">
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
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [uploadedFile?.cachedGeoJSON, geometryType]);

  // Update map style based on selected property and color mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedProperty || !map.getSource('geojson-source')) {
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
          const stops: any[] = [];
          const numColors = continuousStyle.gradientColors.length;
          const range = continuousStyle.maxValue - continuousStyle.minValue;
          
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
        if (map.getLayer('geojson-outline-layer')) {
          map.setPaintProperty('geojson-outline-layer', 'line-color', colorExpression);
        }
      }
    } catch (error) {
      console.error('Error updating map style:', error);
    }
  }, [selectedProperty, colorMode, categories, continuousStyle, geometryType]);

  const handleCategoryColorChange = (index: number, color: string) => {
    const newCategories = [...categories];
    newCategories[index].color = color;
    setCategories(newCategories);
  };

  const handleExportMapLibre = () => {
    const dummyStyle = {
      version: 8,
      name: 'Custom Style',
      sources: {
        'custom-source': {
          type: 'geojson',
          data: result.fileName,
        },
      },
      layers: [
        {
          id: 'custom-layer',
          type: geometryType === 'point' ? 'circle' : geometryType === 'line' ? 'line' : 'fill',
          source: 'custom-source',
          paint: {
            'circle-color': colorMode === 'categorical' ? '#7FAD6F' : '#7FAD6F',
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(dummyStyle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'style-maplibre.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportReEarth = () => {
    const dummyStyle = {
      type: 'reearth-style',
      version: '1.0.0',
      layers: [
        {
          id: 'custom-layer',
          type: geometryType,
          style: {
            color: colorMode === 'categorical' ? '#7FAD6F' : '#7FAD6F',
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(dummyStyle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'style-reearth.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        {/* Map Preview */}
        <div
          ref={mapContainerRef}
          className="flex-1 rounded-[32px] relative"
          style={{
            backgroundColor: '#F0F5EE',
            boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            aspectRatio: '16 / 9',
            minHeight: '500px',
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
                  {t.categoricalMode || 'Color by category (categorical)'}
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
                  {t.continuousMode || 'Gradient by value (continuous)'}
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
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Green
                    </button>
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Blue
                    </button>
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Red
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {categories.map((category, index) => (
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
                        <input
                          type="color"
                          value={category.color}
                          onChange={(e) => handleCategoryColorChange(index, e.target.value)}
                          className="w-6 h-6 rounded border cursor-pointer"
                          style={{ borderColor: '#C8D8C5' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.minValue || 'Min Value'}: {continuousStyle.minValue.toLocaleString()}
                  </div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.maxValue || 'Max Value'}: {continuousStyle.maxValue.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: '#5A6A58' }}
                  >
                    {t.selectGradient || 'Select Gradient'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Green
                    </button>
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Blue
                    </button>
                    <button
                      className="px-4 py-2 rounded-full text-sm border"
                      style={{
                        backgroundColor: '#F8FAF7',
                        borderColor: '#C8D8C5',
                        color: '#2A3A28',
                      }}
                    >
                      Red
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Legend Preview */}
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
              {t.legendPreview || 'Legend Preview'}
            </h3>
            <div className="space-y-2">
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
                    <span>{continuousStyle.minValue.toLocaleString()}</span>
                    <span>{continuousStyle.maxValue.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Export Buttons */}
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

