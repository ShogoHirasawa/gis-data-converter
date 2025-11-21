import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface HowToUsePageProps {
  onBack: () => void;
}

const HowToUsePage: React.FC<HowToUsePageProps> = ({ onBack }) => {
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
          {t.howToUseTitle}
        </h1>

        <div className="space-y-8">
          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.howToUseSection1Title}
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: '#5A6A58' }}
            >
              {t.howToUseSection1Text}
            </p>
            <ul
              className="list-disc list-inside space-y-2 text-base leading-relaxed"
              style={{ color: '#5A6A58' }}
            >
              <li>{t.howToUseSection1Method1}</li>
              <li>{t.howToUseSection1Method2}</li>
            </ul>
            <p
              className="text-sm mt-4"
              style={{ color: '#8A9A88' }}
            >
              {t.howToUseSection1Formats}<br />
              {t.howToUseSection1MaxSize}
            </p>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.howToUseSection2Title}
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: '#5A6A58' }}
            >
              {t.howToUseSection2Text}
            </p>
            <ul
              className="list-disc list-inside space-y-2 text-base leading-relaxed"
              style={{ color: '#5A6A58' }}
            >
              <li>{t.howToUseSection2GeoJson}</li>
              <li>{t.howToUseSection2Kml}</li>
              <li>{t.howToUseSection2Gpx}</li>
              <li>{t.howToUseSection2Csv}</li>
              <li>{t.howToUseSection2TopoJson}</li>
              <li>{t.howToUseSection2Pbf}</li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.howToUseSection3Title}
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: '#5A6A58' }}
            >
              {t.howToUseSection3Text}
            </p>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.howToUseSection4Title}
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: '#5A6A58' }}
            >
              {t.howToUseSection4Text}
            </p>
          </section>

          <section>
            <h2
              className="text-2xl mb-4 font-semibold"
              style={{ color: '#2A3A28' }}
            >
              {t.howToUseNotesTitle}
            </h2>
            <ul
              className="list-disc list-inside space-y-2 text-base leading-relaxed"
              style={{ color: '#5A6A58' }}
            >
              <li>{t.howToUseNotes1}</li>
              <li>{t.howToUseNotes2}</li>
              <li>{t.howToUseNotes3}</li>
              <li>{t.howToUseNotes4}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HowToUsePage;


