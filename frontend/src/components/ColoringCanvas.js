import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw, ChevronLeft, ChevronRight, Eraser } from 'lucide-react';
import { floodFill } from '@/utils/floodFill';

const PALETTE = [
  '#FF0000', '#FF00A8', '#FFD4F8',
  '#FF9900', '#FFC6B0', '#FFF3B3',
  '#E9FF00', '#FCFFC2', '#AEFF7C',
  '#00A000', '#C2FFC6', '#00FFB3',
  '#0000FF', '#00A8FF', '#C6DAFF',
  '#6900FF', '#BD99FF', '#C647FF',
];

const COLORING_PAGES = [
  { id: 'floral_bouquet', name: 'Floral Bouquet', url: '/coloring/1.jpg' },
  { id: 'heart_mandala', name: 'Heart Mandala', url: '/coloring/2.jpg' },
  { id: 'flower_mandala', name: 'Flower Mandala', url: '/coloring/3.jpg' },
  { id: 'mandala_pattern', name: 'Mandala Pattern', url: '/coloring/4.jpg' },
  { id: 'greek_mandala', name: 'Greek Mandala', url: '/coloring/5.jpg' },
  { id: 'flower_heart', name: 'Flower Heart', url: '/coloring/6.jpg' },
  { id: 'ornate_mandala', name: 'Ornate Mandala', url: '/coloring/7.jpg' },
  { id: 'flower_circle', name: 'Flower Circle', url: '/coloring/8.jpg' },
  { id: 'lotus_bloom', name: 'Lotus Bloom', url: '/coloring/9.jpg' },
];

export default function ColoringCanvas({ onClose }) {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const originalDataRef = useRef(null);

  const page = COLORING_PAGES[pageIdx];
  const activeColor = isEraser ? '#FFFFFF' : selectedColor;

  const loadImage = useCallback((url) => {
    setLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Full screen: use available viewport size
      const maxW = window.innerWidth - 16;
      const maxH = window.innerHeight - 200; // leave room for toolbar
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);

      canvas.width = w;
      canvas.height = h;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      originalDataRef.current = ctx.getImageData(0, 0, w, h).data.slice();
      setLoading(false);
    };
    img.onerror = () => {
      const maxSize = Math.min(500, window.innerWidth - 32);
      canvas.width = maxSize;
      canvas.height = maxSize;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, maxSize, maxSize);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Could not load image', maxSize / 2, maxSize / 2);
      setLoading(false);
    };
    img.src = url;
  }, []);

  useEffect(() => {
    loadImage(page.url);
  }, [page.url, loadImage]);

  const handleCanvasClick = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
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
    floodFill(imageData, x, y, activeColor, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  }, [activeColor, loading]);

  const reset = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalDataRef.current) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    imageData.data.set(originalDataRef.current);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const prevPage = () => {
    setPageIdx((pageIdx - 1 + COLORING_PAGES.length) % COLORING_PAGES.length);
  };
  const nextPage = () => {
    setPageIdx((pageIdx + 1) % COLORING_PAGES.length);
  };

  const selectColor = (color) => {
    setSelectedColor(color);
    setIsEraser(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col" data-testid="coloring-canvas-modal">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white shrink-0">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100" data-testid="close-coloring-canvas">
          <X className="w-5 h-5 text-slate-500" />
        </button>

        <div className="flex items-center gap-1">
          <button onClick={prevPage} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="prev-page-btn">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
            {page.name} <span className="text-slate-400 text-xs">({pageIdx + 1}/{COLORING_PAGES.length})</span>
          </span>
          <button onClick={nextPage} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="next-page-btn">
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <button onClick={reset} className="p-2 rounded-xl hover:bg-slate-100" data-testid="reset-coloring-btn" title="Start Over">
          <RotateCcw className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Canvas area - fills available space */}
      <div className="flex-1 flex items-center justify-center bg-[#FFF9F5] overflow-hidden relative p-2">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="w-8 h-8 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="rounded-lg cursor-crosshair touch-none max-w-full max-h-full"
          data-testid="coloring-canvas"
        />
      </div>

      {/* Bottom color palette */}
      <div className="shrink-0 bg-white border-t border-slate-100 px-3 pt-2 pb-14" data-testid="color-palette-bar">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pr-36" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Eraser button */}
          <button
            onClick={() => setIsEraser(true)}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
              isEraser
                ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 bg-white border-slate-300'
                : 'hover:scale-105 bg-slate-50 border-slate-200'
            }`}
            data-testid="eraser-btn"
            title="Eraser"
          >
            <Eraser className="w-4 h-4 text-slate-500" />
          </button>

          <div className="w-px h-7 bg-slate-200 shrink-0 mx-0.5" />

          {/* Color swatches */}
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => selectColor(color)}
              className={`shrink-0 w-9 h-9 rounded-full transition-all border ${
                !isEraser && selectedColor === color ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
              } border-transparent`}
              style={{
                backgroundColor: color,
                '--tw-ring-color': color,
              }}
              data-testid={`palette-color-${color.replace('#', '')}`}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
