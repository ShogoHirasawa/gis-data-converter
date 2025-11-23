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

  // Get all available format options
  // Note: GPX is supported as input but not as output
  const getAllFormatOptions = () => {
    const baseOptions = [
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
        id: 'csv',
        name: t.csvTitle,
        description: t.csvDesc,
        icon: 'table',
      },
      {
        id: 'pbf',
        name: t.pbfTitle,
        description: t.pbfDesc,
        icon: 'archive',
      },
    ];

    // Add Shapefile option if input is Shapefile
    if (uploadedFile.format === 'shapefile') {
      baseOptions.unshift({
        id: 'shapefile',
        name: 'Shapefile',
        description: 'Standard GIS format with multiple files (ZIP)',
        icon: 'archive',
      });
    }

    return baseOptions;
  };

  const formatOptions = getAllFormatOptions();

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
      pbf: 'PBF',
    };
    return formatMap[format.toLowerCase()] || format;
  };

  // Generate detected format message dynamically based on the actual format
  const getDetectedFormatMessage = (): string => {
    if (!uploadedFile.format) {
      return t.detectedFormat;
    }
    
    const formatName = getFormatDisplayName(uploadedFile.format);
    
    // Try to replace "Shapefile" in the message with the actual format name
    // This works for both English and Japanese (and other languages)
    let message = t.detectedFormat;
    
    // Replace "Shapefile" or "Shapefile形式" or "Shapefile format" with the actual format
    message = message.replace(/Shapefile形式/g, `${formatName}形式`);
    message = message.replace(/Shapefile format/gi, `${formatName} format`);
    message = message.replace(/Shapefile/gi, formatName);
    
    // If no replacement occurred, construct a new message
    // Check if the message still contains "Shapefile" (case-insensitive)
    if (message.toLowerCase().includes('shapefile')) {
      // For Japanese: "あなたのファイルは{format}形式です"
      if (t.detectedFormat.includes('あなたのファイルは')) {
        return `✓ あなたのファイルは${formatName}形式です`;
      }
      // For English: "Your file is detected as {format} format"
      if (t.detectedFormat.includes('Your file is detected as')) {
        return `✓ Your file is detected as ${formatName} format`;
      }
      // Fallback: try to construct from the base message
      const baseMessage = t.detectedFormat.replace(/Shapefile/gi, formatName);
      return baseMessage;
    }
    
    return message;
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

