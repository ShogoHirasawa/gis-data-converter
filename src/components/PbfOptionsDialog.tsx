/**
 * PBF Options Dialog
 * Dialog for entering zoom levels and layer name for PBF conversion
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface PbfOptions {
  minZoom: number;
  maxZoom: number;
  layerName: string;
}

interface PbfOptionsDialogProps {
  isOpen: boolean;
  onConfirm: (options: PbfOptions) => void;
  onCancel: () => void;
}

const PbfOptionsDialog: React.FC<PbfOptionsDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [minZoom, setMinZoom] = useState<string>('0');
  const [maxZoom, setMaxZoom] = useState<string>('14');
  const [layerName, setLayerName] = useState<string>('layer');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const min = parseInt(minZoom, 10);
    const max = parseInt(maxZoom, 10);

    if (isNaN(min) || isNaN(max)) {
      alert('Please enter valid zoom levels');
      return;
    }

    if (min < 0 || min > 24 || max < 0 || max > 24) {
      alert('Zoom levels must be between 0 and 24');
      return;
    }

    if (min > max) {
      alert('Minimum zoom must be less than or equal to maximum zoom');
      return;
    }

    if (!layerName.trim()) {
      alert('Please enter a layer name');
      return;
    }

    onConfirm({
      minZoom: min,
      maxZoom: max,
      layerName: layerName.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div
        className="relative p-8 rounded-[32px] shadow-gentle max-w-md w-full mx-4"
        style={{ backgroundColor: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 hover:opacity-70 transition"
          style={{ color: '#5A6A58' }}
        >
          <X size={24} />
        </button>

        <h2
          className="text-2xl mb-6 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          PBF Conversion Options
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="minZoom"
              className="block text-base mb-2 font-medium"
              style={{ color: '#2A3A28' }}
            >
              Minimum Zoom Level (0-24)
            </label>
            <input
              id="minZoom"
              type="number"
              min="0"
              max="24"
              value={minZoom}
              onChange={(e) => setMinZoom(e.target.value)}
              className="w-full px-4 py-3 rounded-[16px] border text-base"
              style={{
                backgroundColor: '#F8FAF7',
                borderColor: '#E8F3E4',
                color: '#2A3A28',
              }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="maxZoom"
              className="block text-base mb-2 font-medium"
              style={{ color: '#2A3A28' }}
            >
              Maximum Zoom Level (0-24)
            </label>
            <input
              id="maxZoom"
              type="number"
              min="0"
              max="24"
              value={maxZoom}
              onChange={(e) => setMaxZoom(e.target.value)}
              className="w-full px-4 py-3 rounded-[16px] border text-base"
              style={{
                backgroundColor: '#F8FAF7',
                borderColor: '#E8F3E4',
                color: '#2A3A28',
              }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="layerName"
              className="block text-base mb-2 font-medium"
              style={{ color: '#2A3A28' }}
            >
              Layer Name
            </label>
            <input
              id="layerName"
              type="text"
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              className="w-full px-4 py-3 rounded-[16px] border text-base"
              style={{
                backgroundColor: '#F8FAF7',
                borderColor: '#E8F3E4',
                color: '#2A3A28',
              }}
              placeholder="layer"
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 rounded-[16px] text-base font-medium transition"
              style={{
                backgroundColor: '#F8FAF7',
                color: '#5A6A58',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 rounded-[16px] text-base font-medium transition"
              style={{
                backgroundColor: '#7FAD6F',
                color: '#FFFFFF',
              }}
            >
              Convert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PbfOptionsDialog;

