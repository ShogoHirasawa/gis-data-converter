import React, { useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { XCircle, Circle, RefreshCw, FolderOpen } from 'lucide-react';

interface UploadErrorStateProps {
  onReset: () => void;
  onFileUpload: (file: File) => void;
}

const UploadErrorState: React.FC<UploadErrorStateProps> = ({
  onReset,
  onFileUpload,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

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
          <XCircle 
            size={48}
            style={{ color: '#B84830' }}
          />
        </div>
        <h2
          className="text-2xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.uploadFailed}
        </h2>
        <div
          className="mb-8 p-6 rounded-[24px]"
          style={{ backgroundColor: '#F5DDD9' }}
        >
          <p
            className="text-lg mb-4 font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.uploadFailedReason}
          </p>
          <ul
            className="text-base text-left"
            style={{ color: '#5A6A58' }}
          >
            <li className="flex items-start gap-3 mb-3">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle 
                  size={12}
                  style={{ color: '#B84830' }}
                />
              </div>
              <span>{t.uploadErrorTip1}</span>
            </li>
            <li className="flex items-start gap-3 mb-3">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle 
                  size={12}
                  style={{ color: '#B84830' }}
                />
              </div>
              <span>{t.uploadErrorTip2}</span>
            </li>
            <li className="flex items-start gap-3 mb-3">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle 
                  size={12}
                  style={{ color: '#B84830' }}
                />
              </div>
              <span>{t.uploadErrorTip3}</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex justify-center items-center w-5 h-5 mt-0.5">
                <Circle 
                  size={12}
                  style={{ color: '#B84830' }}
                />
              </div>
              <span>{t.uploadErrorTip4}</span>
            </li>
          </ul>
        </div>
        <div className="flex flex-row gap-4">
          <button
            onClick={onReset}
            className="flex-1 flex justify-center items-center gap-3 rounded-full shadow-gentle hover:bg-[#6B9A5B] transition"
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
          <button
            onClick={handleSelectFile}
            className="flex-1 flex justify-center items-center gap-3 border border-solid rounded-full hover:bg-[#F8FAF7] transition"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#7FAD6F',
              padding: '1rem 2rem',
              borderColor: '#C8D8C5',
            }}
          >
            <div className="flex justify-center items-center w-5 h-5">
              <FolderOpen size={20} />
            </div>
            <span className="text-base whitespace-nowrap font-semibold">
              {t.selectDifferentFile}
            </span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.geojson,.json,.kml,.csv,.gpx"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="File input"
      />
    </div>
  );
};

export default UploadErrorState;

