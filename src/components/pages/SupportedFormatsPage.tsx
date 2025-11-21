import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SupportedFormatsPageProps {
  onBack: () => void;
}

const SupportedFormatsPage: React.FC<SupportedFormatsPageProps> = ({ onBack }) => {
  const { t } = useLanguage();
  return (
    <div className="w-full max-w-4xl mx-auto px-8 py-12">
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-8 text-base font-medium hover:opacity-70 transition"
        style={{ color: '#5A6A58' }}
      >
        <ArrowLeft size={20} />
        <span>{t.back}</span>
      </button>

      <div
        className="p-12 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <h1
          className="text-3xl mb-8 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.supportedFormatsTitle}
        </h1>

        <div className="space-y-8">
          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.supportedFormatsInputTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: t.supportedFormatsInputShapefile,
                  extension: '.zip',
                  description: t.supportedFormatsInputShapefileDesc,
                },
                {
                  name: t.supportedFormatsInputGeoJson,
                  extension: '.geojson, .json',
                  description: t.supportedFormatsInputGeoJsonDesc,
                },
                {
                  name: t.supportedFormatsInputKml,
                  extension: '.kml',
                  description: t.supportedFormatsInputKmlDesc,
                },
                {
                  name: t.supportedFormatsInputCsv,
                  extension: '.csv',
                  description: t.supportedFormatsInputCsvDesc,
                },
                {
                  name: t.supportedFormatsInputGpx,
                  extension: '.gpx',
                  description: t.supportedFormatsInputGpxDesc,
                },
              ].map((format) => (
                <div
                  key={format.name}
                  className="p-6 rounded-[24px]"
                  style={{ backgroundColor: '#F8FAF7' }}
                >
                  <h3
                    className="text-xl mb-2 font-semibold"
                    style={{ color: '#2A3A28' }}
                  >
                    {format.name}
                  </h3>
                  <p
                    className="text-sm mb-3 font-medium"
                    style={{ color: '#7FAD6F' }}
                  >
                    {format.extension}
                  </p>
                  <p
                    className="text-base leading-relaxed"
                    style={{ color: '#5A6A58' }}
                  >
                    {format.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.supportedFormatsOutputTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: t.supportedFormatsOutputGeoJson,
                  extension: '.geojson',
                  description: t.supportedFormatsOutputGeoJsonDesc,
                },
                {
                  name: t.supportedFormatsOutputKml,
                  extension: '.kml',
                  description: t.supportedFormatsOutputKmlDesc,
                },
                {
                  name: t.supportedFormatsOutputGpx,
                  extension: '.gpx',
                  description: t.supportedFormatsOutputGpxDesc,
                },
                {
                  name: t.supportedFormatsOutputCsv,
                  extension: '.csv',
                  description: t.supportedFormatsOutputCsvDesc,
                },
                {
                  name: t.supportedFormatsOutputTopoJson,
                  extension: '.topojson',
                  description: t.supportedFormatsOutputTopoJsonDesc,
                },
                {
                  name: t.supportedFormatsOutputPbf,
                  extension: '.pbf',
                  description: t.supportedFormatsOutputPbfDesc,
                },
              ].map((format) => (
                <div
                  key={format.name}
                  className="p-6 rounded-[24px]"
                  style={{ backgroundColor: '#F8FAF7' }}
                >
                  <h3
                    className="text-xl mb-2 font-semibold"
                    style={{ color: '#2A3A28' }}
                  >
                    {format.name}
                  </h3>
                  <p
                    className="text-sm mb-3 font-medium"
                    style={{ color: '#7FAD6F' }}
                  >
                    {format.extension}
                  </p>
                  <p
                    className="text-base leading-relaxed"
                    style={{ color: '#5A6A58' }}
                  >
                    {format.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.supportedFormatsLimitationsTitle}
            </h2>
            <ul
              className="list-disc list-inside space-y-2 text-base leading-relaxed"
              style={{ color: '#5A6A58' }}
            >
              <li>{t.supportedFormatsLimitations1}</li>
              <li>{t.supportedFormatsLimitations2}</li>
              <li>{t.supportedFormatsLimitations3}</li>
              <li>{t.supportedFormatsLimitations4}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SupportedFormatsPage;


