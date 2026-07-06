import { useState, useEffect } from 'react';
import axios from 'axios';
import { Wind, Hand, Paintbrush, Headphones, Eye, ChevronRight } from 'lucide-react';
import API from '@/config/api';
import ASMRPlayer from '@/components/ASMRPlayer';
import ColoringCanvas from '@/components/ColoringCanvas';
import BoxBreathingGuide from '@/components/BoxBreathingGuide';
import ActivityDetail from '@/components/ActivityDetail';

const categoryIcons = {
  grounding: Eye,
  breathing: Wind,
  physical: Hand,
  creative: Paintbrush,
  sensory: Headphones,
};

export default function CalmCorner() {
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showASMR, setShowASMR] = useState(false);
  const [showColoring, setShowColoring] = useState(false);
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
          onStartASMR={() => setShowASMR(true)}
          onStartColoring={() => setShowColoring(true)}
        />
        {showBreathing && <BoxBreathingGuide onClose={() => setShowBreathing(false)} />}
        {showASMR && <ASMRPlayer onClose={() => setShowASMR(false)} />}
        {showColoring && <ColoringCanvas onClose={() => setShowColoring(false)} />}
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
      {showASMR && <ASMRPlayer onClose={() => setShowASMR(false)} />}
      {showColoring && <ColoringCanvas onClose={() => setShowColoring(false)} />}
    </div>
  );
}
