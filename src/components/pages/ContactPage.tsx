import React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface ContactPageProps {
  onBack: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onBack }) => {
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
          {t.contactTitle}
        </h1>

        <div className="space-y-8">
          <section>
            <p
              className="text-base leading-relaxed mb-6"
              style={{ color: '#5A6A58' }}
            >
              {t.contactDescription}
            </p>
            
            <div
              className="p-6 rounded-[24px]"
              style={{ backgroundColor: '#F8FAF7' }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex justify-center items-center w-12 h-12 rounded-[16px]"
                  style={{ backgroundColor: '#E8F3E4' }}
                >
                  <Mail 
                    size={24}
                    style={{ color: '#7FAD6F' }}
                  />
                </div>
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: '#2A3A28' }}
                  >
                    {t.contactEmailTitle}
                  </h2>
                </div>
              </div>
              <a
                href="mailto:contact@gis-data-converter.cloud"
                className="text-lg font-medium hover:text-[#7FAD6F] transition"
                style={{ color: '#5A6A58' }}
              >
                contact@gis-data-converter.cloud
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;

