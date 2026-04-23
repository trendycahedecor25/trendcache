import { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, User, Baby, Clock, AlertTriangle, Target, Trophy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import API from '@/config/api';

const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

const sectionConfig = [
  { key: 'children', label: 'Your Children', icon: Baby, color: '#FF715B' },
  { key: 'family_situation', label: 'Family Situation', icon: User, color: '#8B5CF6' },
  { key: 'schedule', label: 'Your Schedule', icon: Clock, color: '#4E9FE5' },
  { key: 'triggers', label: 'Known Stressors', icon: AlertTriangle, color: '#FFB627' },
  { key: 'preferences', label: 'How You Like Support', icon: Sparkles, color: '#10B981' },
  { key: 'goals', label: 'Your Goals', icon: Target, color: '#FF715B' },
  { key: 'wins', label: 'Your Wins', icon: Trophy, color: '#FFB627' },
  { key: 'key_facts', label: 'Things She Remembers', icon: Brain, color: '#4E9FE5' },
];

function renderValue(key, value) {
  if (key === 'children' && Array.isArray(value)) {
    return (
      <div className="space-y-1.5">
        {value.map((child, i) => (
          <div key={i} className="text-sm text-slate-700">
            <span className="font-medium">{child.name || 'Unknown'}</span>
            {child.age && <span className="text-slate-500"> — age {child.age}</span>}
            {child.details && <span className="text-slate-500"> — {child.details}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
            <span className="text-slate-300 mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm text-slate-700">{value}</p>;
}

export default function WillowMemory() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/profile/willow-memory`, { withCredentials: true })
      .then((res) => setProfile(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  // Empty state
  if (!profile || !profile.has_profile) {
    return (
      <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#FF715B]/5 rounded-3xl p-6 border border-[#8B5CF6]/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="willow-memory-card">
        <div className="flex items-center gap-3 mb-3">
          <img src={WILLOW_AVATAR} alt="Willow" className="w-9 h-9 rounded-full" />
          <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#8B5CF6]" /> What Willow Knows About You
          </h3>
        </div>
        <p className="text-sm text-slate-500">Willow is still getting to know you! The more you chat, the more she'll remember about your life, your kids, and what matters to you.</p>
      </div>
    );
  }

  // Find which sections have data
  const activeSections = sectionConfig.filter(s => {
    const val = profile[s.key];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });

  if (activeSections.length === 0) {
    return null;
  }

  const displaySections = expanded ? activeSections : activeSections.slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#FF715B]/5 rounded-3xl p-6 border border-[#8B5CF6]/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="willow-memory-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img src={WILLOW_AVATAR} alt="Willow" className="w-9 h-9 rounded-full" />
          <div>
            <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#8B5CF6]" /> What Willow Knows About You
            </h3>
            <p className="text-xs text-slate-500">Willow learns about you with every conversation</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {displaySections.map((section) => (
          <div key={section.key} className="bg-white/60 rounded-2xl p-4 border border-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${section.color}15` }}>
                <section.icon className="w-3.5 h-3.5" style={{ color: section.color }} strokeWidth={2.5} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section.label}</span>
            </div>
            {renderValue(section.key, profile[section.key])}
          </div>
        ))}
      </div>

      {activeSections.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition-colors mx-auto"
          data-testid="willow-memory-toggle"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>See all ({activeSections.length} categories) <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}

      {profile.preferred_name && (
        <p className="text-xs text-slate-400 mt-4 text-center">Willow calls you "{profile.preferred_name}"</p>
      )}
    </div>
  );
}
