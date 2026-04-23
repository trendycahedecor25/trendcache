import { useState, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';

const PALETTE = [
  '#FF715B', '#FFB627', '#10B981', '#4E9FE5', '#8B5CF6',
  '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#A855F7',
  '#F43F5E', '#14B8A6', '#EAB308', '#6366F1', '#D946EF',
];

// SVG mandala pattern with clickable sections
const PATTERNS = [
  {
    id: 'mandala',
    name: 'Mandala',
    viewBox: '0 0 400 400',
    sections: [
      // Center circle
      { d: 'M200,200 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0', id: 'center' },
      // Inner petals (8)
      ...Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 45) * Math.PI / 180;
        const cx = 200 + Math.cos(angle) * 60;
        const cy = 200 + Math.sin(angle) * 60;
        return { d: `M200,200 Q${200 + Math.cos(angle - 0.4) * 80},${200 + Math.sin(angle - 0.4) * 80} ${cx},${cy} Q${200 + Math.cos(angle + 0.4) * 80},${200 + Math.sin(angle + 0.4) * 80} 200,200`, id: `inner-${i}` };
      }),
      // Middle ring segments (12)
      ...Array.from({ length: 12 }, (_, i) => {
        const a1 = (i * 30) * Math.PI / 180;
        const a2 = ((i + 1) * 30) * Math.PI / 180;
        const r1 = 90, r2 = 130;
        return {
          d: `M${200 + Math.cos(a1) * r1},${200 + Math.sin(a1) * r1} L${200 + Math.cos(a1) * r2},${200 + Math.sin(a1) * r2} A${r2},${r2} 0 0,1 ${200 + Math.cos(a2) * r2},${200 + Math.sin(a2) * r2} L${200 + Math.cos(a2) * r1},${200 + Math.sin(a2) * r1} A${r1},${r1} 0 0,0 ${200 + Math.cos(a1) * r1},${200 + Math.sin(a1) * r1}`,
          id: `mid-${i}`
        };
      }),
      // Outer petals (16)
      ...Array.from({ length: 16 }, (_, i) => {
        const angle = (i * 22.5) * Math.PI / 180;
        const tip = 180;
        const base = 140;
        const cx = 200 + Math.cos(angle) * tip;
        const cy = 200 + Math.sin(angle) * tip;
        return {
          d: `M${200 + Math.cos(angle) * base},${200 + Math.sin(angle) * base} Q${200 + Math.cos(angle - 0.2) * (tip + 10)},${200 + Math.sin(angle - 0.2) * (tip + 10)} ${cx},${cy} Q${200 + Math.cos(angle + 0.2) * (tip + 10)},${200 + Math.sin(angle + 0.2) * (tip + 10)} ${200 + Math.cos(angle) * base},${200 + Math.sin(angle) * base}`,
          id: `outer-${i}`
        };
      }),
    ]
  },
  {
    id: 'geometric',
    name: 'Geometric',
    viewBox: '0 0 400 400',
    sections: [
      // Concentric shapes
      { d: 'M200,200 m-25,0 a25,25 0 1,0 50,0 a25,25 0 1,0 -50,0', id: 'g-center' },
      // Diamond ring
      { d: 'M200,150 L250,200 L200,250 L150,200 Z M200,170 L230,200 L200,230 L170,200 Z', id: 'g-diamond' },
      // Triangles around diamond (8)
      ...Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 45) * Math.PI / 180;
        const r = 90;
        const w = 25;
        const cx = 200 + Math.cos(angle) * r;
        const cy = 200 + Math.sin(angle) * r;
        return {
          d: `M${cx},${cy} L${cx + Math.cos(angle + 0.6) * w},${cy + Math.sin(angle + 0.6) * w} L${cx + Math.cos(angle - 0.6) * w},${cy + Math.sin(angle - 0.6) * w} Z`,
          id: `g-tri-${i}`
        };
      }),
      // Square segments (4 large)
      { d: 'M120,120 L200,100 L280,120 L200,140 Z', id: 'g-sq-0' },
      { d: 'M280,120 L300,200 L280,280 L260,200 Z', id: 'g-sq-1' },
      { d: 'M280,280 L200,300 L120,280 L200,260 Z', id: 'g-sq-2' },
      { d: 'M120,280 L100,200 L120,120 L140,200 Z', id: 'g-sq-3' },
      // Corner circles (4)
      ...[[130, 130], [270, 130], [270, 270], [130, 270]].map(([x, y], i) => ({
        d: `M${x},${y} m-18,0 a18,18 0 1,0 36,0 a18,18 0 1,0 -36,0`,
        id: `g-corner-${i}`
      })),
      // Outer border segments (8)
      ...Array.from({ length: 8 }, (_, i) => {
        const a1 = (i * 45 + 10) * Math.PI / 180;
        const a2 = ((i + 1) * 45 - 10) * Math.PI / 180;
        const r = 170;
        return {
          d: `M${200 + Math.cos(a1) * (r - 20)},${200 + Math.sin(a1) * (r - 20)} A${r - 20},${r - 20} 0 0,1 ${200 + Math.cos(a2) * (r - 20)},${200 + Math.sin(a2) * (r - 20)} L${200 + Math.cos(a2) * r},${200 + Math.sin(a2) * r} A${r},${r} 0 0,0 ${200 + Math.cos(a1) * r},${200 + Math.sin(a1) * r} Z`,
          id: `g-border-${i}`
        };
      }),
    ]
  }
];

export default function ColoringCanvas({ onClose }) {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [fills, setFills] = useState({});
  const [patternIdx, setPatternIdx] = useState(0);

  const pattern = PATTERNS[patternIdx];

  const fillSection = useCallback((sectionId) => {
    setFills(prev => ({ ...prev, [sectionId]: selectedColor }));
  }, [selectedColor]);

  const reset = () => {
    setFills({});
  };

  const switchPattern = () => {
    setFills({});
    setPatternIdx((patternIdx + 1) % PATTERNS.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="coloring-canvas-modal">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 z-10" data-testid="close-coloring-canvas">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="font-['Outfit'] font-bold text-xl text-slate-900 mb-1">Mini Coloring</h3>
        <p className="text-sm text-slate-500 mb-4">Pick a color, tap to fill. No rules. Just breathe and color.</p>

        {/* SVG Canvas */}
        <div className="bg-[#FFF9F5] rounded-2xl p-4 mb-4">
          <svg viewBox={pattern.viewBox} className="w-full h-auto" style={{ maxHeight: '320px' }}>
            {/* Background circle */}
            <circle cx="200" cy="200" r="195" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            {pattern.sections.map((section) => (
              <path
                key={section.id}
                d={section.d}
                fill={fills[section.id] || 'white'}
                stroke="#cbd5e1"
                strokeWidth="1.5"
                onClick={() => fillSection(section.id)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                data-testid={`color-section-${section.id}`}
              />
            ))}
          </svg>
        </div>

        {/* Color palette */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pick a color</p>
          <div className="flex flex-wrap gap-2" data-testid="color-palette">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full transition-all ${
                  selectedColor === color ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color, ringColor: color }}
                data-testid={`palette-color-${color.replace('#', '')}`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors" data-testid="reset-coloring-btn">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
          <button onClick={switchPattern} className="flex-1 py-2.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-xl text-sm font-medium hover:bg-[#8B5CF6]/20 transition-colors" data-testid="switch-pattern-btn">
            {patternIdx === 0 ? 'Try Geometric' : 'Try Mandala'}
          </button>
        </div>
      </div>
    </div>
  );
}
