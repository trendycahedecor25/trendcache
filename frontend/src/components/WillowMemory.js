import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Brain, User, Baby, Clock, AlertTriangle, Target, Trophy, ChevronDown, ChevronUp, Sparkles, Pencil, Trash2, X, Check, Plus } from 'lucide-react';

import API from '@/config/api';

const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

const sectionConfig = [
  { key: 'children', label: 'Your Children', icon: Baby, color: '#FF715B', type: 'children' },
  { key: 'family_situation', label: 'Family Situation', icon: User, color: '#8B5CF6', type: 'string' },
  { key: 'schedule', label: 'Your Schedule', icon: Clock, color: '#4E9FE5', type: 'string' },
  { key: 'triggers', label: 'Known Stressors', icon: AlertTriangle, color: '#FFB627', type: 'array' },
  { key: 'preferences', label: 'How You Like Support', icon: Sparkles, color: '#10B981', type: 'string' },
  { key: 'goals', label: 'Your Goals', icon: Target, color: '#FF715B', type: 'array' },
  { key: 'wins', label: 'Your Wins', icon: Trophy, color: '#FFB627', type: 'array' },
  { key: 'key_facts', label: 'Things She Remembers', icon: Brain, color: '#4E9FE5', type: 'array' },
];

// ── Inline editor for a string field ──
function StringEditor({ value, onSave, onCancel }) {
  const [text, setText] = useState(value || '');
  return (
    <div className="flex gap-2 mt-1">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none"
        rows={2}
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <button onClick={() => onSave(text)} className="p-1.5 rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-colors" data-testid="save-edit-btn">
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
        </button>
        <button onClick={onCancel} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors" data-testid="cancel-edit-btn">
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}

// ── Inline editor for array items ──
function ArrayEditor({ items, onSave, onCancel }) {
  const [list, setList] = useState([...items]);
  const [newItem, setNewItem] = useState('');

  const removeItem = (idx) => setList(list.filter((_, i) => i !== idx));
  const addItem = () => {
    if (newItem.trim()) {
      setList([...list, newItem.trim()]);
      setNewItem('');
    }
  };
  const updateItem = (idx, val) => {
    const updated = [...list];
    updated[idx] = val;
    setList(updated);
  };

  return (
    <div className="mt-1 space-y-2">
      {list.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
          <button onClick={() => removeItem(i)} className="p-1 rounded-lg hover:bg-red-50 transition-colors" data-testid={`remove-item-${i}`}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add new..."
          className="flex-1 text-sm border border-dashed border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          data-testid="add-new-item-input"
        />
        <button onClick={addItem} className="p-1.5 rounded-lg bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 transition-colors" data-testid="add-new-item-btn">
          <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(list.filter(i => i.trim()))} className="px-3 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] text-xs font-medium hover:bg-[#10B981]/20 transition-colors" data-testid="save-array-btn">
          Save
        </button>
        <button onClick={onCancel} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium hover:bg-slate-200 transition-colors" data-testid="cancel-array-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Children editor ──
function ChildrenEditor({ children, onSave, onCancel }) {
  const [kids, setKids] = useState(children.map(c => ({ ...c })));

  const updateKid = (idx, field, val) => {
    const updated = [...kids];
    updated[idx] = { ...updated[idx], [field]: val };
    setKids(updated);
  };
  const removeKid = (idx) => setKids(kids.filter((_, i) => i !== idx));
  const addKid = () => setKids([...kids, { name: '', age: '', details: '' }]);

  return (
    <div className="mt-1 space-y-3">
      {kids.map((kid, i) => (
        <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
          <div className="flex-1 space-y-2">
            <input
              value={kid.name || ''}
              onChange={(e) => updateKid(i, 'name', e.target.value)}
              placeholder="Name"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 font-medium"
            />
            <div className="flex gap-2">
              <input
                value={kid.age || ''}
                onChange={(e) => updateKid(i, 'age', e.target.value)}
                placeholder="Age"
                className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
              <input
                value={kid.details || ''}
                onChange={(e) => updateKid(i, 'details', e.target.value)}
                placeholder="Details (school, interests...)"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
            </div>
          </div>
          <button onClick={() => removeKid(i)} className="p-1 rounded-lg hover:bg-red-50 transition-colors mt-1" data-testid={`remove-child-${i}`}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      ))}
      <button onClick={addKid} className="flex items-center gap-1.5 text-xs font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition-colors" data-testid="add-child-btn">
        <Plus className="w-3.5 h-3.5" /> Add child
      </button>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(kids.filter(k => k.name?.trim()))} className="px-3 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] text-xs font-medium hover:bg-[#10B981]/20 transition-colors" data-testid="save-children-btn">
          Save
        </button>
        <button onClick={onCancel} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium hover:bg-slate-200 transition-colors" data-testid="cancel-children-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Read-only renderers ──
function renderValue(key, value) {
  if (key === 'children' && Array.isArray(value)) {
    return (
      <div className="space-y-1.5">
        {value.map((child) => (
          <div key={child.name || Math.random()} className="text-sm text-slate-700">
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
        {value.map((item) => (
          <li key={item} className="text-sm text-slate-700 flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm text-slate-700">{value}</p>;
}

// ── Main component ──
export default function WillowMemory() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(() => {
    axios.get(`${API}/profile/willow-memory`, { withCredentials: true })
      .then((res) => setProfile(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveField = async (key, value) => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/profile/willow-memory`, { [key]: value }, { withCredentials: true });
      setProfile(res.data);
      setEditingKey(null);
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };

  const deleteField = async (key) => {
    setSaving(true);
    try {
      const res = await axios.delete(`${API}/profile/willow-memory`, {
        data: { field: key },
        withCredentials: true
      });
      setProfile(res.data);
    } catch (err) {
      console.error('Delete error:', err);
    }
    setSaving(false);
  };

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

  const activeSections = sectionConfig.filter(s => {
    const val = profile[s.key];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });

  if (activeSections.length === 0) return null;

  const displaySections = expanded ? activeSections : activeSections.slice(0, 3);

  return (
    <div className={`bg-gradient-to-br from-[#8B5CF6]/5 to-[#FF715B]/5 rounded-3xl p-6 border border-[#8B5CF6]/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${saving ? 'opacity-70 pointer-events-none' : ''}`} data-testid="willow-memory-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img src={WILLOW_AVATAR} alt="Willow" className="w-9 h-9 rounded-full" />
          <div>
            <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#8B5CF6]" /> What Willow Knows About You
            </h3>
            <p className="text-xs text-slate-500">Click the pencil to edit anything</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {displaySections.map((section) => {
          const isEditing = editingKey === section.key;
          const value = profile[section.key];

          return (
            <div key={section.key} className="bg-white/60 rounded-2xl p-4 border border-white" data-testid={`memory-section-${section.key}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${section.color}15` }}>
                    <section.icon className="w-3.5 h-3.5" style={{ color: section.color }} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section.label}</span>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingKey(section.key)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                      data-testid={`edit-${section.key}-btn`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#8B5CF6] transition-colors" />
                    </button>
                    <button
                      onClick={() => deleteField(section.key)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors group"
                      data-testid={`delete-${section.key}-btn`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                section.type === 'children' ? (
                  <ChildrenEditor children={value} onSave={(v) => saveField(section.key, v)} onCancel={() => setEditingKey(null)} />
                ) : section.type === 'array' ? (
                  <ArrayEditor items={value} onSave={(v) => saveField(section.key, v)} onCancel={() => setEditingKey(null)} />
                ) : (
                  <StringEditor value={value} onSave={(v) => saveField(section.key, v)} onCancel={() => setEditingKey(null)} />
                )
              ) : (
                renderValue(section.key, value)
              )}
            </div>
          );
        })}
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
