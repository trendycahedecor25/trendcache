import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const PALETTE = [
  '#EE1F25', '#E5007A', '#F5B3E6',
  '#F58723', '#FBC8C8', '#FDF0AD',
  '#FDEE00', '#F7F7A7', '#B9F57D',
  '#1F9A34', '#B6F0CF', '#36CEC4',
  '#182CBF', '#00A9E8', '#B8CAEF',
  '#7D2EE5', '#BEB2EB', '#C94DB0',
  '#FFFFFF',
];

const COLORING_PAGES = [
  { id: 'heart_mandala', name: 'Heart Mandala', url: '/coloring/1.jpg' },
  { id: 'flower_bouquet', name: 'Flower Bouquet', url: '/coloring/2.jpg' },
  { id: 'flower_cluster', name: 'Flower Cluster', url: '/coloring/3.jpg' },
  { id: 'daisy_bunch', name: 'Daisy Bunch', url: '/coloring/5.jpg' },
  { id: 'flower_heart', name: 'Flower Heart', url: '/coloring/6.jpg' },
  { id: 'garden_circle', name: 'Garden Circle', url: '/coloring/7.jpg' },
  { id: 'star_mandala', name: 'Star Mandala', url: '/coloring/8.jpg' },
  { id: 'lotus', name: 'Lotus', url: '/coloring/9.jpg' },
  { id: 'greek_sunflower', name: 'Greek Sunflower', url: '/coloring/10.jpg' },
];

// Boundary threshold: pixels darker than this are considered "lines" (walls)
const BOUNDARY_THRESHOLD = 200;
// How similar a pixel must be to the start pixel to be filled
const FILL_TOLERANCE = 50;

function floodFill(imageData, startX, startY, fillColor, width, height) {
  const data = imageData.data;
  const idx = (x, y) => (y * width + x) * 4;

  const si = idx(startX, startY);
  const startR = data[si];
  const startG = data[si + 1];
  const startB = data[si + 2];

  // Don't fill if clicking on a dark line
  const startBrightness = (startR + startG + startB) / 3;
  if (startBrightness < BOUNDARY_THRESHOLD) return;

  // Parse fill color
  const fr = parseInt(fillColor.slice(1, 3), 16);
  const fg = parseInt(fillColor.slice(3, 5), 16);
  const fb = parseInt(fillColor.slice(5, 7), 16);

  // Don't fill if already the target color
  if (Math.abs(startR - fr) < 10 && Math.abs(startG - fg) < 10 && Math.abs(startB - fb) < 10) return;

  // Check if a pixel is similar enough to the starting pixel to be filled
  const canFill = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Must be bright enough (not a line)
    const brightness = (r + g + b) / 3;
    if (brightness < BOUNDARY_THRESHOLD) return false;
    // Must be similar to the starting color
    const dr = Math.abs(r - startR);
    const dg = Math.abs(g - startG);
    const db = Math.abs(b - startB);
    return dr < FILL_TOLERANCE && dg < FILL_TOLERANCE && db < FILL_TOLERANCE;
  };

  // Scanline flood fill (much faster than stack-based for large areas)
  const visited = new Uint8Array(width * height);
  const queue = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const i = idx(x, y);

    // Fill this pixel
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;

    // Check 4 neighbors
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const vi = ny * width + nx;
      if (visited[vi]) continue;
      visited[vi] = 1;
      const ni = idx(nx, ny);
      if (canFill(ni)) {
        queue.push([nx, ny]);
      }
    }
  }
}

export default function ColoringCanvas({ onClose }) {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const originalDataRef = useRef(null);

  const page = COLORING_PAGES[pageIdx];

  const loadImage = useCallback((url) => {
    setLoading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Use the image's natural dimensions, scaled to fit mobile
      const maxSize = Math.min(600, window.innerWidth - 64);
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);

      canvas.width = w;
      canvas.height = h;

      // Draw white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      // Draw image to fill the canvas
      ctx.drawImage(img, 0, 0, w, h);

      // Store original for reset
      originalDataRef.current = ctx.getImageData(0, 0, w, h).data.slice();

      setLoading(false);
    };
    img.onerror = () => {
      const maxSize = Math.min(500, window.innerWidth - 64);
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
    floodFill(imageData, x, y, selectedColor, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  }, [selectedColor, loading]);

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
        <div className="bg-[#FFF9F5] rounded-2xl p-3 mb-3 flex items-center justify-center relative min-h-[200px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl z-10">
              <div className="w-8 h-8 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasClick}
            className="rounded-xl cursor-crosshair touch-none w-full h-auto"
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
                className={`w-8 h-8 rounded-full transition-all border ${
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
          <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors" data-testid="reset-coloring-btn">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
