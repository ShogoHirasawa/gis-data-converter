import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

type PageType = 'how-to-use' | 'supported-formats';

interface FooterProps {
  onPageChange: (page: PageType) => void;
}

const Footer: React.FC<FooterProps> = ({ onPageChange }) => {
  const { t } = useLanguage();

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, page: PageType) => {
    e.preventDefault();
    onPageChange(page);
  };

  return (
    <footer
      className="w-full mt-16 p-8"
      style={{
        background: 'linear-gradient(135deg, rgba(218, 234, 214, 0.4) 0%, rgba(234, 242, 230, 0.2) 100%), #FCFDF9'
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-8">
            <a
              href="#"
              onClick={(e) => handleLinkClick(e, 'how-to-use')}
              className="text-base font-medium hover:text-[#7FAD6F] transition cursor-pointer"
              style={{ color: '#5A6A58' }}
            >
              {t.howToUse}
            </a>
            <a
              href="#"
              onClick={(e) => handleLinkClick(e, 'supported-formats')}
              className="text-base font-medium hover:text-[#7FAD6F] transition cursor-pointer"
              style={{ color: '#5A6A58' }}
            >
              {t.supportedFormatsLink}
            </a>
          </div>
          <div className="text-base" style={{ color: '#8A9A88' }}>
            {t.copyright}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

