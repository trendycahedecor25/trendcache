import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const PALETTE = [
  '#FF715B', '#FFB627', '#10B981', '#4E9FE5', '#8B5CF6',
  '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#A855F7',
  '#F43F5E', '#14B8A6', '#EAB308', '#6366F1', '#D946EF',
  '#FFFFFF',
];

const COLORING_PAGES = [
  { id: 'daisy', name: 'Daisy', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/2f6u7fx2_1.png' },
  { id: 'butterfly', name: 'Butterfly', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/9fhkmwmc_2.png' },
  { id: 'lily_valley', name: 'Lily of the Valley', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/qqj3hmhn_3.png' },
  { id: 'hydrangea', name: 'Hydrangea', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/f519pisk_4.png' },
  { id: 'hyacinth', name: 'Hyacinth', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/7c306dep_5.png' },
  { id: 'flower_7', name: 'Wildflower', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/95nzrqe6_7.png' },
  { id: 'flower_9', name: 'Blossom', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/bzj51o7g_9.png' },
  { id: 'heart_mandala', name: 'Heart Mandala', url: 'https://customer-assets.emergentagent.com/job_github-explorer-21/artifacts/y78j4dxh_10.png' },
];

const LINE_THRESHOLD = 80;

function floodFill(imageData, startX, startY, fillColor, width, height) {
  const data = imageData.data;
  const idx = (y, x) => (y * width + x) * 4;

  const startIdx = idx(startY, startX);
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];

  // Don't fill if clicking on a line (dark pixel)
  const brightness = (startR + startG + startB) / 3;
  if (brightness < LINE_THRESHOLD) return;

  // Don't fill if already the target color
  const fr = parseInt(fillColor.slice(1, 3), 16);
  const fg = parseInt(fillColor.slice(3, 5), 16);
  const fb = parseInt(fillColor.slice(5, 7), 16);

  if (Math.abs(startR - fr) < 5 && Math.abs(startG - fg) < 5 && Math.abs(startB - fb) < 5) return;

  const matchColor = (i) => {
    const dr = Math.abs(data[i] - startR);
    const dg = Math.abs(data[i + 1] - startG);
    const db = Math.abs(data[i + 2] - startB);
    return dr < 30 && dg < 30 && db < 30;
  };

  const stack = [[startX, startY]];
  const visited = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const vi = y * width + x;
    if (visited[vi]) continue;
    visited[vi] = 1;

    const i = idx(y, x);
    if (!matchColor(i)) continue;

    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

export default function ColoringCanvas({ onClose }) {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const lineDataRef = useRef(null);

  const page = COLORING_PAGES[pageIdx];

  const loadImage = useCallback((url) => {
    setLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = Math.min(500, window.innerWidth - 48);
      canvas.width = size;
      canvas.height = size;

      // White background first
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Draw image centered and scaled
      const scale = Math.min(size / img.width, size / img.height) * 0.9;
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);

      // Process: make lines dark, background white
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < LINE_THRESHOLD) {
          // Dark pixel = line, make it pure black
          data[i] = 30;
          data[i + 1] = 30;
          data[i + 2] = 30;
          data[i + 3] = 255;
        } else {
          // Light pixel = fillable area, make it white
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Store line data for redraw after fills
      lineDataRef.current = new Uint8Array(data.length);
      lineDataRef.current.set(data);

      setLoading(false);
    };
    img.onerror = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Could not load image', canvas.width / 2, canvas.height / 2);
      setLoading(false);
    };
    img.src = url;
  }, []);

  useEffect(() => {
    loadImage(page.url);
  }, [page.url, loadImage]);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodFill(imageData, x, y, selectedColor, canvas.width, canvas.height);

    // Re-apply lines on top so they're never covered
    if (lineDataRef.current) {
      const lines = lineDataRef.current;
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (lines[i] + lines[i + 1] + lines[i + 2]) / 3;
        if (brightness < LINE_THRESHOLD) {
          data[i] = lines[i];
          data[i + 1] = lines[i + 1];
          data[i + 2] = lines[i + 2];
          data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [selectedColor, loading]);

  const reset = useCallback(() => {
    loadImage(page.url);
  }, [page.url, loadImage]);

  const prevPage = () => {
    setPageIdx((pageIdx - 1 + COLORING_PAGES.length) % COLORING_PAGES.length);
  };
  const nextPage = () => {
    setPageIdx((pageIdx + 1) % COLORING_PAGES.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="coloring-canvas-modal">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 relative max-h-[95vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-xl hover:bg-slate-100 z-10" data-testid="close-coloring-canvas">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="font-['Outfit'] font-bold text-lg text-slate-900 mb-0.5">Mini Coloring</h3>
        <p className="text-xs text-slate-500 mb-3">Pick a color, tap to fill. No rules.</p>

        {/* Page selector */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevPage} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="prev-page-btn">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700">{page.name} <span className="text-slate-400">({pageIdx + 1}/{COLORING_PAGES.length})</span></span>
          <button onClick={nextPage} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="next-page-btn">
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Canvas */}
        <div className="bg-[#FFF9F5] rounded-2xl p-3 mb-3 flex items-center justify-center relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl z-10">
              <div className="w-8 h-8 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasClick}
            className="rounded-xl cursor-crosshair touch-none max-w-full"
            style={{ maxHeight: '400px' }}
            data-testid="coloring-canvas"
          />
        </div>

        {/* Color palette */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pick a color</p>
          <div className="flex flex-wrap gap-2" data-testid="color-palette">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-7 h-7 rounded-full transition-all border ${
                  selectedColor === color ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                } ${color === '#FFFFFF' ? 'border-slate-300' : 'border-transparent'}`}
                style={{ backgroundColor: color, ringColor: color === '#FFFFFF' ? '#94a3b8' : color }}
                data-testid={`palette-color-${color.replace('#', '')}`}
                title={color === '#FFFFFF' ? 'Eraser (white)' : color}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors" data-testid="reset-coloring-btn">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
