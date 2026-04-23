import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Wind, Hand, Paintbrush, Headphones, Eye, ChevronRight, X, ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import API from '@/config/api';

const categoryIcons = {
  grounding: Eye,
  breathing: Wind,
  physical: Hand,
  creative: Paintbrush,
  sensory: Headphones,
};

// ── Box Breathing Visual Guide ──
function BoxBreathingGuide({ onClose }) {
  const [phase, setPhase] = useState('ready');
  const [count, setCount] = useState(4);
  const [cycle, setCycle] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const phases = [
    { key: 'inhale', label: 'Breathe In', color: '#4E9FE5' },
    { key: 'hold1', label: 'Hold', color: '#10B981' },
    { key: 'exhale', label: 'Breathe Out', color: '#8B5CF6' },
    { key: 'hold2', label: 'Hold', color: '#FFB627' },
  ];

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
        setPhase(phases[phaseIdx].key);
      }
      setCount(c);
    }, 1000);
  }, [cleanup, phases]);

  useEffect(() => cleanup, [cleanup]);

  const currentPhase = phases.find(p => p.key === phase);
  const boxScale = phase === 'inhale' ? 'scale-110' : phase === 'exhale' ? 'scale-90' : 'scale-100';

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
                I'm good
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

// ── Activity Detail View ──
function ActivityDetail({ activity, onBack, onStartBreathing }) {
  return (
    <div className="animate-fade-in-up" data-testid={`activity-detail-${activity.id}`}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors" data-testid="back-to-activities">
        <ArrowLeft className="w-4 h-4" /> Back to activities
      </button>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{activity.category}</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">{activity.duration}</span>
        </div>
        <h2 className="font-['Outfit'] text-2xl font-bold text-slate-900 mb-3">{activity.title}</h2>
        <p className="text-slate-600 mb-6">{activity.description}</p>

        <div className="bg-[#FFF9F5] rounded-2xl p-5 mb-6">
          <h4 className="font-['Outfit'] font-semibold text-slate-900 mb-4">How to do it:</h4>
          <ol className="space-y-3">
            {activity.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FF715B]/10 text-[#FF715B] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          <span className="font-medium text-slate-600 shrink-0">Best for:</span>
          <span>{activity.when}</span>
        </div>

        {activity.guided && (
          <button
            onClick={onStartBreathing}
            className="mt-6 w-full py-3 bg-[#4E9FE5] text-white rounded-2xl font-medium hover:bg-[#3B8DD4] transition-colors flex items-center justify-center gap-2"
            data-testid="start-guided-btn"
          >
            <Play className="w-4 h-4" /> Start Guided Exercise
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Calm Corner ──
export default function CalmCorner() {
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showBreathing, setShowBreathing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/calm-corner/activities`, { withCredentials: true })
      .then((res) => {
        setActivities(res.data.activities);
        setCategories(res.data.categories);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded-xl w-48" />
          <div className="h-4 bg-slate-100 rounded-lg w-80" />
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const filtered = selectedCategory
    ? activities.filter(a => a.category === selectedCategory)
    : activities;

  // Detail view
  if (selectedActivity) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto">
        <ActivityDetail
          activity={selectedActivity}
          onBack={() => setSelectedActivity(null)}
          onStartBreathing={() => setShowBreathing(true)}
        />
        {showBreathing && <BoxBreathingGuide onClose={() => setShowBreathing(false)} />}
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto" data-testid="calm-corner-page">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-slate-900 mb-2">Calm Corner</h1>
        <p className="text-slate-500">Quick activities to lower anxiety and reset your nervous system. None of these take more than a few minutes.</p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8 animate-fade-in-up" data-testid="category-filters">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
            !selectedCategory ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
          }`}
          data-testid="filter-all"
        >
          All
        </button>
        {categories.map((cat) => {
          const Icon = categoryIcons[cat.id] || Eye;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
              data-testid={`filter-${cat.id}`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Activity cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="activity-cards">
        {filtered.map((activity) => {
          const cat = categories.find(c => c.id === activity.category);
          const catColor = cat?.color || '#64748b';
          const Icon = categoryIcons[activity.category] || Eye;

          return (
            <button
              key={activity.id}
              onClick={() => setSelectedActivity(activity)}
              className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-transparent hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left group"
              data-testid={`activity-card-${activity.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${catColor}12` }}>
                  <Icon className="w-5 h-5" style={{ color: catColor }} strokeWidth={2} />
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${catColor}10`, color: catColor }}>
                  {activity.duration}
                </span>
              </div>
              <h3 className="font-['Outfit'] font-semibold text-slate-900 mb-1 group-hover:text-[#FF715B] transition-colors">{activity.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-3">{activity.when}</p>
              <div className="flex items-center gap-1 text-xs font-medium text-[#FF715B] opacity-0 group-hover:opacity-100 transition-opacity">
                Try this <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {showBreathing && <BoxBreathingGuide onClose={() => setShowBreathing(false)} />}
    </div>
  );
}
