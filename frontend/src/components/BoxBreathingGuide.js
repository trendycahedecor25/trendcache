import { useState, useEffect, useRef, useCallback } from 'react';
import { Wind, X, Play, Pause, RotateCcw } from 'lucide-react';

const PHASES = [
  { key: 'inhale', label: 'Breathe In', color: '#4E9FE5' },
  { key: 'hold1', label: 'Hold', color: '#10B981' },
  { key: 'exhale', label: 'Breathe Out', color: '#8B5CF6' },
  { key: 'hold2', label: 'Hold', color: '#FFB627' },
];

export default function BoxBreathingGuide({ onClose }) {
  const [phase, setPhase] = useState('ready');
  const [count, setCount] = useState(4);
  const [cycle, setCycle] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = useCallback(() => {
    setRunning(true);
    setCycle(0);
    setPhase('inhale');
    setCount(4);
    let phaseIdx = 0;
    let c = 4;
    let cycles = 0;

    cleanup();
    timerRef.current = setInterval(() => {
      c--;
      if (c <= 0) {
        phaseIdx++;
        if (phaseIdx >= 4) {
          phaseIdx = 0;
          cycles++;
          if (cycles >= 4) {
            clearInterval(timerRef.current);
            setPhase('done');
            setRunning(false);
            return;
          }
        }
        c = 4;
        setCycle(cycles);
        setPhase(PHASES[phaseIdx].key);
      }
      setCount(c);
    }, 1000);
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  const currentPhase = PHASES.find(p => p.key === phase);
  let boxScale = 'scale-100';
  if (phase === 'inhale') boxScale = 'scale-110';
  else if (phase === 'exhale') boxScale = 'scale-90';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="breathing-guide-modal">
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center relative">
        <button onClick={() => { cleanup(); onClose(); }} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100" data-testid="close-breathing-guide">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="font-['Outfit'] font-bold text-xl text-slate-900 mb-2">Box Breathing</h3>
        <p className="text-sm text-slate-500 mb-8">4 cycles to calm</p>

        {phase === 'ready' && (
          <div>
            <div className="w-32 h-32 mx-auto rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-6">
              <Wind className="w-10 h-10 text-slate-300" />
            </div>
            <button onClick={start} className="px-6 py-3 bg-[#4E9FE5] text-white rounded-2xl font-medium hover:bg-[#3B8DD4] transition-colors flex items-center gap-2 mx-auto" data-testid="start-breathing-btn">
              <Play className="w-4 h-4" /> Begin
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div>
            <div className="w-32 h-32 mx-auto rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-6">
              <span className="text-4xl">&#10003;</span>
            </div>
            <p className="text-lg font-medium text-slate-900 mb-2">Well done, mama</p>
            <p className="text-sm text-slate-500 mb-6">Take a moment to notice how you feel now.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={start} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1" data-testid="restart-breathing-btn">
                <RotateCcw className="w-3.5 h-3.5" /> Again
              </button>
              <button onClick={() => { cleanup(); onClose(); }} className="px-4 py-2 bg-[#10B981] text-white rounded-xl text-sm font-medium hover:bg-[#0D9668]" data-testid="done-breathing-btn">
                {"I'm good"}
              </button>
            </div>
          </div>
        )}

        {currentPhase && phase !== 'ready' && phase !== 'done' && (
          <div>
            <div className={`w-32 h-32 mx-auto rounded-2xl flex items-center justify-center mb-6 transition-all duration-1000 ${boxScale}`} style={{ backgroundColor: `${currentPhase.color}15`, borderColor: currentPhase.color, borderWidth: 2 }}>
              <span className="font-['Outfit'] text-5xl font-bold" style={{ color: currentPhase.color }}>{count}</span>
            </div>
            <p className="text-lg font-semibold mb-1" style={{ color: currentPhase.color }}>{currentPhase.label}</p>
            <p className="text-xs text-slate-400">Cycle {cycle + 1} of 4</p>
          </div>
        )}
      </div>
    </div>
  );
}
