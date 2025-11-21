import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConversionResult } from '../../types';
import { CheckCircle, FileText, Download, RefreshCw } from 'lucide-react';

interface CompletedStateProps {
  result: ConversionResult;
  onDownload: () => void;
  onReset: () => void;
}

const CompletedState: React.FC<CompletedStateProps> = ({
  result,
  onDownload,
  onReset,
}) => {
  const { t } = useLanguage();

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div
        className="p-16 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div
          className="flex justify-center items-center w-20 h-20 mb-8 rounded-full mx-auto"
          style={{ backgroundColor: '#C8E4C1' }}
        >
          <CheckCircle 
            size={48}
            style={{ color: '#2A3A28' }}
          />
        </div>
        <h2
          className="text-2xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.conversionComplete}
        </h2>
        <div
          className="mb-8 p-6 rounded-[24px]"
          style={{ backgroundColor: '#F8FAF7' }}
        >
          <div className="flex justify-between items-center">
            <div className="text-left">
              <p
                className="text-lg font-semibold"
                style={{ color: '#2A3A28' }}
              >
                {result.fileName}
              </p>
              <p
                className="text-base"
                style={{ color: '#5A6A58' }}
              >
                {result.format.toUpperCase()} format • {formatFileSize(result.size)}
              </p>
            </div>
            <div
              className="flex justify-center items-center w-12 h-12 rounded-[16px]"
              style={{ backgroundColor: '#E8F3E4' }}
            >
              <FileText 
                size={24}
                style={{ color: '#7FAD6F' }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-row gap-4">
          <button
            onClick={onDownload}
            className="flex-1 flex justify-center items-center gap-3 rounded-full shadow-gentle hover:bg-[#6B9A5B] transition"
            style={{
              backgroundColor: '#7FAD6F',
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '1rem 2rem',
            }}
          >
            <div className="flex justify-center items-center w-5 h-5">
              <Download size={20} />
            </div>
            <span className="text-base whitespace-nowrap font-semibold">
              {t.download}
            </span>
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex justify-center items-center gap-3 border border-solid rounded-full hover:bg-[#F8FAF7] transition"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#7FAD6F',
              padding: '1rem 2rem',
              borderColor: '#C8D8C5',
            }}
          >
            <div className="flex justify-center items-center w-5 h-5">
              <RefreshCw size={20} />
            </div>
            <span className="text-base whitespace-nowrap font-semibold">
              {t.convertNew}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletedState;

