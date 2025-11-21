import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { AlertCircle, Circle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  onReset: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ onReset }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div
        className="p-16 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div
          className="flex justify-center items-center w-20 h-20 mb-8 rounded-full mx-auto"
          style={{ backgroundColor: '#F5DDD9' }}
        >
          <AlertCircle 
            size={48}
            style={{ color: '#E5B8B0' }}
          />
        </div>
        <h2
          className="text-2xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.conversionFailed}
        </h2>
        <div
          className="mb-8 p-6 rounded-[24px]"
          style={{ backgroundColor: '#F5DDD9' }}
        >
          <p
            className="text-lg mb-2 font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.failedReason}
          </p>
          <p
            className="text-base"
            style={{ color: '#5A6A58' }}
          >
            {t.failedInstruction}
          </p>
        </div>
        <div>
          <ul
            className="text-base text-left mb-6"
            style={{ color: '#5A6A58' }}
          >
            <li className="flex items-start gap-3 mb-2">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle size={12} />
              </div>
              <span>{t.errorTip1}</span>
            </li>
            <li className="flex items-start gap-3 mb-2">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle size={12} />
              </div>
              <span>{t.errorTip2}</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle size={12} />
              </div>
              <span>{t.errorTip3}</span>
            </li>
          </ul>
          <button
            onClick={onReset}
            className="flex justify-center items-center gap-3 rounded-full shadow-gentle hover:bg-[#6B9A5B] transition mx-auto"
            style={{
              backgroundColor: '#7FAD6F',
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '1rem 2rem',
            }}
          >
            <div className="flex justify-center items-center w-5 h-5">
              <RefreshCw size={20} />
            </div>
            <span className="text-base whitespace-nowrap font-semibold">
              {t.tryAgain}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;

