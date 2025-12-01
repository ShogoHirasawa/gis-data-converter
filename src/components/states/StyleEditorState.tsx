import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConversionResult, UploadedFile, ColorMode, CategoricalCategory, ContinuousStyle } from '../../types';
import { ChevronDown, Download, ArrowLeft, RefreshCw } from 'lucide-react';

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

  // Dummy data
  const [selectedProperty, setSelectedProperty] = useState<string>('city_name');
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

  const dummyProperties = ['city_name', 'population', 'area', 'prefecture'];
  const dummyFeatureCount = 1234;
  const geometryType = uploadedFile?.geometryType || 'point';

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
              <div
                className="text-base"
                style={{ color: '#2A3A28' }}
              >
                {dummyFeatureCount.toLocaleString()} {t.other === 'その他' ? '件' : 'features'}
              </div>
            </div>

            {/* Available Properties */}
            <div>
              <div
                className="mb-2 text-sm font-medium"
                style={{ color: '#5A6A58' }}
              >
                {t.availableProperties || 'Available Properties'}
              </div>
              <div className="flex flex-wrap gap-2">
                {dummyProperties.map((prop) => (
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
            </div>
          </div>
        </div>

        {/* Map Preview */}
        <div
          className="flex-1 flex items-center justify-center rounded-[32px]"
          style={{
            backgroundColor: '#F0F5EE',
            boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            aspectRatio: '16 / 9',
            minHeight: '500px',
          }}
        >
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
              property: {selectedProperty} / mode: {colorMode}
            </div>
          </div>
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
              >
                {dummyProperties.map((prop) => (
                  <option key={prop} value={prop}>
                    {prop}
                  </option>
                ))}
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

