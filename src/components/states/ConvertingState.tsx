import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Loader2 } from 'lucide-react';

interface ConvertingStateProps {
  progress: number;
}

const ConvertingState: React.FC<ConvertingStateProps> = ({ progress }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div
        className="p-16 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div
          className="flex justify-center items-center w-20 h-20 mb-8 rounded-full mx-auto"
          style={{ backgroundColor: '#E8F3E4' }}
        >
          <Loader2 
            size={32}
            className="animate-spin"
            style={{ color: '#7FAD6F' }}
          />
        </div>
        <h2
          className="text-2xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.converting}
        </h2>

        <div
          className="w-full h-2 mb-4 rounded-full"
          style={{ backgroundColor: '#E8F3E4' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              backgroundColor: '#7FAD6F',
              width: `${progress}%`,
            }}
          />
        </div>
        <div className="flex justify-between items-center mb-6">
          <span
            className="text-2xl font-semibold"
            style={{ color: '#7FAD6F' }}
          >
            {progress}%
          </span>
        </div>
        <p
          className="text-base"
          style={{ color: '#5A6A58' }}
        >
          {t.processingText}
        </p>
      </div>
    </div>
  );
};

export default ConvertingState;

