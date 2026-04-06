import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, BookOpen, Sparkles, Trash2, X, Loader2, Crown } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const moodOptions = ['Happy', 'Grateful', 'Calm', 'Anxious', 'Tired', 'Overwhelmed', 'Hopeful', 'Frustrated'];
const moodColors = {
  Happy: '#FFB627', Grateful: '#10B981', Calm: '#4E9FE5', Anxious: '#8B5CF6',
  Tired: '#64748B', Overwhelmed: '#FF715B', Hopeful: '#F59E0B', Frustrated: '#EF4444'
};

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptsLocked, setPromptsLocked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const res = await axios.get(`${API}/journal`, { withCredentials: true });
      setEntries(res.data);
    } catch (err) { console.error(err); }
  };

  const saveEntry = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/journal`, { title, content, mood }, { withCredentials: true });
      setTitle(''); setContent(''); setMood('');
      setShowEditor(false);
      loadEntries();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const deleteEntry = async (entryId) => {
    try {
      await axios.delete(`${API}/journal/${entryId}`, { withCredentials: true });
      loadEntries();
    } catch (err) { console.error(err); }
  };

  const getPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const res = await axios.get(`${API}/journal/prompts`, { withCredentials: true });
      setPrompts(res.data.prompts || []);
      setPromptsLocked(false);
    } catch (err) {
      if (err.response?.status === 403) {
        setPromptsLocked(true);
      }
      console.error(err);
    }
    finally { setLoadingPrompts(false); }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto" data-testid="journal-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-slate-900">Journal</h1>
          <p className="text-slate-500 mt-1">Your safe space to reflect and grow.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={getPrompts}
            disabled={loadingPrompts}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#FFB627]/30 text-[#FFB627] hover:bg-[#FFB627]/5 transition-all text-sm font-medium"
            data-testid="get-prompts-btn"
          >
            {loadingPrompts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Prompts
          </button>
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-2 bg-[#FF715B] text-white px-4 py-2.5 rounded-2xl hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.3)] transition-all text-sm font-medium"
            data-testid="new-entry-btn"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* AI Prompts or Upgrade Banner */}
      {promptsLocked && (
        <div className="mb-6 bg-gradient-to-r from-[#FFB627]/5 to-[#FF715B]/5 rounded-3xl p-5 border border-[#FFB627]/10 animate-fade-in-up flex items-center justify-between" data-testid="prompts-locked-banner">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-[#FFB627]" />
            <div>
              <p className="text-sm font-medium text-slate-800">AI Prompts are a Premium Feature</p>
              <p className="text-xs text-slate-500">Upgrade to get personalized journaling prompts from Willow</p>
            </div>
          </div>
          <button onClick={() => navigate('/pricing')} className="bg-[#FFB627] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#F0A820] transition-all whitespace-nowrap" data-testid="journal-upgrade-btn">
            Upgrade
          </button>
        </div>
      )}

      {/* AI Prompts */}
      {prompts.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-[#FFB627]/5 to-[#FF715B]/5 rounded-3xl p-5 border border-[#FFB627]/10 animate-fade-in-up" data-testid="prompts-section">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFB627]" /> Willow's Prompts for You
            </h3>
            <button onClick={() => setPrompts([])} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {prompts.map((p, i) => (
              <button
                key={i}
                onClick={() => { setTitle(''); setContent(''); setShowEditor(true); setContent(p); }}
                className="w-full text-left px-4 py-3 rounded-xl bg-white/80 border border-white hover:border-[#FFB627]/20 text-sm text-slate-700 hover:text-slate-900 transition-all"
                data-testid={`prompt-${i}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" data-testid="journal-editor-modal">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-['Outfit'] text-xl font-bold text-slate-900">New Journal Entry</h2>
                <button onClick={() => setShowEditor(false)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400" data-testid="close-editor-btn">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Give your entry a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-lg font-medium text-slate-900 placeholder-slate-300 outline-none mb-4 bg-transparent"
                data-testid="journal-title-input"
              />
              <textarea
                placeholder="What's on your mind? Write freely — this is your safe space..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full text-slate-700 placeholder-slate-300 outline-none resize-none mb-4 bg-slate-50 rounded-2xl p-4 text-sm leading-relaxed"
                data-testid="journal-content-input"
              />
              <div className="mb-6">
                <p className="text-xs text-slate-500 mb-2 font-medium">How are you feeling?</p>
                <div className="flex flex-wrap gap-2" data-testid="mood-selector">
                  {moodOptions.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(mood === m ? '' : m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        mood === m
                          ? 'text-white shadow-md'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={mood === m ? { background: moodColors[m] || '#FF715B' } : {}}
                      data-testid={`mood-option-${m.toLowerCase()}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm font-medium"
                  data-testid="cancel-entry-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEntry}
                  disabled={!title.trim() || !content.trim() || saving}
                  className="flex-1 px-4 py-3 rounded-2xl bg-[#FF715B] text-white hover:bg-[#FF573D] disabled:opacity-40 transition-all text-sm font-medium flex items-center justify-center gap-2"
                  data-testid="save-entry-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length > 0 ? (
        <div className="space-y-4" data-testid="journal-entries-list">
          {entries.map((entry, i) => (
            <div
              key={entry.entry_id}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(255,113,91,0.06)] transition-all animate-fade-in-up group"
              style={{ animationDelay: `${i * 60}ms` }}
              data-testid={`journal-entry-${entry.entry_id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-['Outfit'] font-semibold text-slate-900 truncate">{entry.title}</h3>
                    {entry.mood && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex-shrink-0"
                        style={{ background: moodColors[entry.mood] || '#64748B' }}
                      >
                        {entry.mood}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  <p className="text-sm text-slate-600 line-clamp-2">{entry.content}</p>
                </div>
                <button
                  onClick={() => deleteEntry(entry.entry_id)}
                  className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  data-testid={`delete-entry-${entry.entry_id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20" data-testid="journal-empty-state">
          <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-2">Your journal awaits</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Writing helps process feelings and celebrate wins. Start with a prompt from Willow or just write freely.
          </p>
          <button
            onClick={() => setShowEditor(true)}
            className="bg-[#FF715B] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.3)] transition-all"
            data-testid="empty-new-entry-btn"
          >
            Write Your First Entry
          </button>
        </div>
      )}
    </div>
  );
}
