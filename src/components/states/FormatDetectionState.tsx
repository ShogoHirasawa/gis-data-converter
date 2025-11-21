import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { UploadedFile } from '../../types';
import { CheckCircle, Braces, MapPin, Route, Table, Layers, Archive, ArrowLeft } from 'lucide-react';

interface FormatDetectionStateProps {
  uploadedFile: UploadedFile;
  onFormatSelect: (formatId: string) => void;
  onBack: () => void;
}

const FormatDetectionState: React.FC<FormatDetectionStateProps> = ({
  uploadedFile,
  onFormatSelect,
  onBack,
}) => {
  const { t } = useLanguage();

  const iconMap: Record<string, React.ComponentType<any>> = {
    'braces': Braces,
    'map-pin': MapPin,
    'route': Route,
    'table': Table,
    'layers': Layers,
    'archive': Archive,
  };

  const formatOptions = [
    {
      id: 'geojson',
      name: t.geoJsonTitle,
      description: t.geoJsonDesc,
      icon: 'braces',
      recommended: true,
    },
    {
      id: 'kml',
      name: t.kmlTitle,
      description: t.kmlDesc,
      icon: 'map-pin',
    },
    {
      id: 'gpx',
      name: t.gpxTitle,
      description: t.gpxDesc,
      icon: 'route',
    },
    {
      id: 'csv',
      name: t.csvTitle,
      description: t.csvDesc,
      icon: 'table',
    },
    {
      id: 'topojson',
      name: t.topoJsonTitle,
      description: t.topoJsonDesc,
      icon: 'layers',
    },
    {
      id: 'pbf',
      name: t.pbfTitle,
      description: t.pbfDesc,
      icon: 'archive',
    },
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFormatDisplayName = (format: string): string => {
    const formatMap: Record<string, string> = {
      shapefile: 'Shapefile',
      geojson: 'GeoJSON',
      kml: 'KML',
      csv: 'CSV',
      gpx: 'GPX',
      topojson: 'TopoJSON',
      pbf: 'PBF',
    };
    return formatMap[format.toLowerCase()] || format;
  };

  // Replace "Shapefile format" in detectedFormat message with the actual format name
  const getDetectedFormatMessage = (): string => {
    if (!uploadedFile.format) {
      return t.detectedFormat;
    }
    const formatName = getFormatDisplayName(uploadedFile.format);
    return t.detectedFormat.replace(/Shapefile format/i, `${formatName} format`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-8 text-base font-medium hover:opacity-70 transition"
        style={{ color: '#5A6A58' }}
      >
        <ArrowLeft size={20} />
        <span>{t.back || 'Back'}</span>
      </button>

      <div
        className="mb-16 p-8 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#C8E4C1' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex justify-center items-center w-8 h-8">
            <CheckCircle 
              size={24}
              style={{ color: '#2A3A28' }}
            />
          </div>
          <div>
            <h2
              className="text-xl mb-2 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {getDetectedFormatMessage()}
            </h2>
            <p
              className="text-base"
              style={{ color: '#5A6A58' }}
            >
              {uploadedFile.name} • {formatFileSize(uploadedFile.size)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-16">
        <h3
          className="text-2xl text-center mb-8 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.chooseFormat}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {formatOptions.map((format) => (
            <div
              key={format.id}
              onClick={() => onFormatSelect(format.id)}
              className="relative p-6 rounded-[32px] cursor-pointer shadow-gentle hover:shadow-moderate transition"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              {format.recommended && (
                <div className="absolute top-4 right-4">
                  <span
                    className="text-sm font-medium rounded-full px-3 py-1"
                    style={{
                      backgroundColor: '#C8E4C1',
                      color: '#2A3A28',
                    }}
                  >
                    {t.recommended}
                  </span>
                </div>
              )}
              <div
                className="flex justify-center items-center w-12 h-12 mb-4 rounded-[16px]"
                style={{ backgroundColor: '#E8F3E4' }}
              >
                {React.createElement(iconMap[format.icon] || Braces, {
                  size: 24,
                  style: { color: '#7FAD6F' }
                })}
              </div>
              <h4
                className="text-lg mb-2 font-semibold"
                style={{ color: '#2A3A28' }}
              >
                {format.name}
              </h4>
              <p
                className="text-base"
                style={{ color: '#5A6A58' }}
              >
                {format.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FormatDetectionState;

