import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, Language } from '../i18n/LanguageContext';
import { Map, Globe, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  onHomeClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onHomeClick }) => {
  const { language, setLanguage, t, languageNames } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setIsDropdownOpen(false);
  };

  const languages: Language[] = [
    'en', 'zh-Hant', 'pl', 'es', 'ar', 'sv', 'fr', 'bg', 'th', 'de', 
    'ca', 'tr', 'it', 'nl', 'uk', 'pt', 'el', 'vi', 'ja', 'hi', 
    'ru', 'ko', 'zh-Hans', 'id', 'ms'
  ];

  return (
    <header 
      className="w-full"
      style={{ 
        background: 'linear-gradient(135deg, rgba(218, 234, 214, 0.5) 0%, rgba(234, 242, 230, 0.3) 100%), #FAFBF9'
      }}
    >
      <div className="flex justify-between items-center w-full px-8 py-6">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition"
          onClick={onHomeClick}
        >
          <div 
            className="flex justify-center items-center w-8 h-8 rounded-full"
            style={{ backgroundColor: '#7FAD6F' }}
          >
            <Map 
              size={16}
              style={{ color: 'rgba(255, 255, 255, 0.9)' }}
            />
          </div>
          <span 
            className="text-2xl font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.title}
          </span>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 border border-solid rounded-full px-5 py-3 hover:border-[#C8D8C5] transition"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2EBE0',
            }}
            aria-label="Select language"
            aria-expanded={isDropdownOpen}
          >
            <div className="flex justify-center items-center w-5 h-5">
              <Globe 
                size={20}
                style={{ color: '#5A6A58' }}
              />
            </div>
            <span 
              className="text-base font-medium"
              style={{ color: '#2A3A28' }}
            >
              {languageNames[language]}
            </span>
            <div className="flex justify-center items-center w-4 h-4">
              <ChevronDown 
                size={16}
                style={{ color: '#8A9A88' }}
              />
            </div>
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto z-50 border border-solid rounded-[24px]"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 6px 24px rgba(127, 173, 111, 0.16)',
                borderColor: '#E2EBE0',
              }}
            >
              <div className="p-3">
                {languages.map((lang) => (
                  <div
                    key={lang}
                    onClick={() => handleLanguageSelect(lang)}
                    className={`flex items-center gap-3 mb-1 rounded-[16px] px-4 py-3 cursor-pointer transition ${
                      language === lang 
                        ? '' 
                        : 'hover:bg-[#F8FAF7]'
                    }`}
                    style={{
                      backgroundColor: language === lang ? '#E8F3E4' : 'transparent',
                    }}
                  >
                    <span
                      className={`text-base ${language === lang ? 'font-medium' : ''}`}
                      style={{ color: '#2A3A28' }}
                    >
                      {languageNames[lang]}
                    </span>
                    {language === lang && (
                      <div className="flex justify-center items-center w-4 h-4 ml-auto">
                        <Check 
                          size={16}
                          style={{ color: '#7FAD6F' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

