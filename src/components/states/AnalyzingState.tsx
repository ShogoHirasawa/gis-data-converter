import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage, Language } from '../../i18n/LanguageContext';
import { UploadedFile } from '../../types';

interface AnalyzingStateProps {
  uploadedFile: UploadedFile | null;
}

const analyzingHeadingMap: Partial<Record<Language, string>> = {
  ja: 'データを読み込んでいます...',
  en: 'Loading your data...',
};

const analyzingTipMap: Partial<Record<Language, string>> = {
  ja: '大きなファイルは読み込みに少し時間がかかる場合があります。',
  en: 'Large files may take a little longer. Thanks for your patience.',
};

const formatFileSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) {
    return '';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AnalyzingState: React.FC<AnalyzingStateProps> = ({ uploadedFile }) => {
  const { t, language } = useLanguage();

  const heading = analyzingHeadingMap[language] || t.uploading;
  const tip = analyzingTipMap[language] || t.processingText;
  const fileInfo = uploadedFile
    ? `${uploadedFile.name} • ${formatFileSize(uploadedFile.size)}`
    : '';

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className="p-12 text-center rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
        role="status"
        aria-live="polite"
      >
        <div className="relative flex justify-center items-center w-24 h-24 mx-auto mb-8">
          <span
            className="absolute inset-0 rounded-full border-2 opacity-60 animate-ping"
            style={{ borderColor: '#C8E4C1' }}
            aria-hidden="true"
          />
          <div
            className="flex justify-center items-center w-full h-full rounded-full"
            style={{ backgroundColor: '#E8F3E4' }}
          >
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: '#7FAD6F' }}
            />
          </div>
        </div>

        <h2
          className="text-2xl mb-3 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {heading}
        </h2>
        <p
          className="text-base mb-6"
          style={{ color: '#5A6A58' }}
        >
          {t.processingText}
        </p>

        {uploadedFile && (
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ backgroundColor: '#F8FAF7', color: '#5A6A58' }}
          >
            <span className="text-sm font-medium truncate max-w-full">
              {fileInfo}
            </span>
          </div>
        )}

        <div
          className="loading-progress h-2 rounded-full mt-10"
          style={{ backgroundColor: '#E8F3E4' }}
          aria-hidden="true"
        >
          <span className="loading-progress__bar" />
        </div>

        <p
          className="text-sm mt-4"
          style={{ color: '#8A9A88' }}
        >
          {tip}
        </p>

        <div className="flex justify-center gap-3 mt-8" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="w-3 h-3 rounded-full inline-block animate-bounce"
              style={{
                backgroundColor: '#7FAD6F',
                opacity: 0.6 + index * 0.1,
                animationDelay: `${index * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyzingState;
