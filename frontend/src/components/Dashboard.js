import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MessageCircle, BookOpen, Calendar, Smile, Frown, Meh, Heart, Sparkles, ArrowRight, Sun, CloudRain, Zap, Coffee, Crown, Loader2 } from 'lucide-react';
import ReferralSection from '@/components/ReferralSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

const moods = [
  { score: 1, label: 'Struggling', icon: CloudRain, color: '#4E9FE5' },
  { score: 2, label: 'Low', icon: Frown, color: '#8B5CF6' },
  { score: 3, label: 'Okay', icon: Meh, color: '#FFB627' },
  { score: 4, label: 'Good', icon: Smile, color: '#10B981' },
  { score: 5, label: 'Great', icon: Sun, color: '#FF715B' },
];

const quickActions = [
  { label: 'Meal Ideas', icon: Coffee, prompt: "I need help planning a quick easy meal with what I have on hand", color: '#FF715B' },
  { label: 'Homework Help', icon: Zap, prompt: "Can you help me with my kid's homework?", color: '#FFB627' },
  { label: 'Self-Care', icon: Heart, prompt: "I need some self-care ideas. I'm feeling overwhelmed.", color: '#10B981' },
  { label: 'Activity Ideas', icon: Sparkles, prompt: "What are some fun activities I can do with my kids today?", color: '#4E9FE5' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [moodLogged, setMoodLogged] = useState(false);
  const [recentJournals, setRecentJournals] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [moodInsights, setMoodInsights] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);

  // Handle payment success redirect
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const payment = searchParams.get('payment');
    if (sessionId && payment === 'success') {
      setPollingPayment(true);
      const pollStatus = async (attempts = 0) => {
        if (attempts >= 5) { setPollingPayment(false); return; }
        try {
          const res = await axios.get(`${API}/subscribe/status/${sessionId}`, { withCredentials: true });
          if (res.data.payment_status === 'paid') {
            setPaymentSuccess(true);
            setPollingPayment(false);
            checkAuth(); // Refresh user data with new subscription
            window.history.replaceState({}, '', '/dashboard');
            return;
          }
        } catch (err) { console.error(err); }
        setTimeout(() => pollStatus(attempts + 1), 2000);
      };
      pollStatus();
    }
  }, [searchParams, checkAuth]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [journalRes, eventsRes, insightsRes] = await Promise.all([
          axios.get(`${API}/journal`, { withCredentials: true }),
          axios.get(`${API}/calendar/events`, { withCredentials: true }),
          axios.get(`${API}/mood/insights`, { withCredentials: true }),
        ]);
        setRecentJournals(journalRes.data.slice(0, 3));
        setUpcomingEvents(eventsRes.data.slice(0, 3));
        setMoodInsights(insightsRes.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
    };
    loadData();
  }, []);

  const logMood = async (mood) => {
    try {
      await axios.post(`${API}/mood`, {
        mood_score: mood.score,
        mood_label: mood.label,
        note: ''
      }, { withCredentials: true });
      setMoodLogged(true);
      setTimeout(() => setMoodLogged(false), 3000);
    } catch (err) {
      console.error('Mood log error:', err);
    }
  };

  const startQuickChat = (prompt) => {
    navigate('/chat', { state: { initialMessage: prompt } });
  };

  const firstName = user?.name?.split(' ')[0] || 'Mom';

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-6xl mx-auto" data-testid="dashboard">
      {/* Payment Success Banner */}
      {paymentSuccess && (
        <div className="mb-6 bg-[#10B981]/10 border border-[#10B981]/20 rounded-2xl p-4 flex items-center gap-3 animate-fade-in-up" data-testid="payment-success-banner">
          <Crown className="w-5 h-5 text-[#10B981]" />
          <p className="text-sm text-[#10B981] font-medium">Welcome to HEARD Premium! You now have unlimited access to Willow and all features.</p>
        </div>
      )}

      {/* Payment Polling */}
      {pollingPayment && (
        <div className="mb-6 bg-[#FFB627]/10 border border-[#FFB627]/20 rounded-2xl p-4 flex items-center gap-3" data-testid="payment-polling-banner">
          <Loader2 className="w-5 h-5 text-[#FFB627] animate-spin" />
          <p className="text-sm text-[#FFB627] font-medium">Processing your payment...</p>
        </div>
      )}

      {/* Subscription Status */}
      {user?.subscription && !user.subscription.is_premium && !pollingPayment && (
        <div className="mb-6 bg-gradient-to-r from-[#FF715B]/5 to-[#FFB627]/5 border border-[#FF715B]/10 rounded-2xl p-4 flex items-center justify-between" data-testid="upgrade-banner">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-[#FF715B]" />
            <p className="text-sm text-slate-700">Unlock unlimited Willow conversations & all premium features</p>
          </div>
          <button onClick={() => navigate('/pricing')} className="text-sm font-medium text-[#FF715B] hover:underline whitespace-nowrap" data-testid="upgrade-link">
            Upgrade to Premium
          </button>
        </div>
      )}

      {user?.subscription?.status === 'trial' && (
        <div className="mb-6 bg-[#4E9FE5]/10 border border-[#4E9FE5]/20 rounded-2xl p-4 flex items-center justify-between" data-testid="trial-banner">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#4E9FE5]" />
            <p className="text-sm text-slate-700">Free trial: <strong>{user.subscription.days_left} days left</strong> of full access</p>
          </div>
          <button onClick={() => navigate('/pricing')} className="text-sm font-medium text-[#4E9FE5] hover:underline whitespace-nowrap" data-testid="trial-upgrade-link">
            Keep Premium
          </button>
        </div>
      )}
      {/* Welcome + Mood */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up" data-testid="welcome-card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                {getGreeting()}, {firstName}!
              </h1>
              <p className="text-slate-500">Willow is here whenever you need her. How are you feeling today?</p>
            </div>
            <img src={WILLOW_AVATAR} alt="Willow" className="w-14 h-14 rounded-full willow-glow hidden sm:block" />
          </div>

          {!moodLogged ? (
            <div className="flex flex-wrap gap-3" data-testid="mood-buttons">
              {moods.map((m) => (
                <button
                  key={m.score}
                  onClick={() => logMood(m)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 bg-white"
                  style={{ '--hover-bg': `${m.color}15` }}
                  data-testid={`mood-btn-${m.label.toLowerCase()}`}
                >
                  <m.icon className="w-5 h-5" style={{ color: m.color }} strokeWidth={2} />
                  <span className="text-sm font-medium text-slate-700">{m.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#10B981] animate-fade-in-up" data-testid="mood-logged-message">
              <Heart className="w-5 h-5" fill="#10B981" />
              <span className="font-medium">Thanks for checking in! Willow is keeping track.</span>
            </div>
          )}
        </div>

        {/* Chat with Willow */}
        <div
          className="bg-gradient-to-br from-[#FF715B]/5 to-[#FFB627]/5 rounded-3xl p-6 border border-[#FF715B]/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(255,113,91,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up delay-100 flex flex-col justify-between"
          onClick={() => navigate('/chat')}
          data-testid="chat-card"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={WILLOW_AVATAR} alt="Willow" className="w-10 h-10 rounded-full" />
              <div>
                <h3 className="font-['Outfit'] font-semibold text-slate-900">Chat with Willow</h3>
                <p className="text-xs text-slate-500">Always here for you</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">Whether you need to vent, plan, or just talk — Willow is ready to listen.</p>
          </div>
          <div className="flex items-center gap-2 text-[#FF715B] font-medium text-sm">
            Start a conversation <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 animate-fade-in-up delay-200">
        <h2 className="font-['Outfit'] font-semibold text-lg text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => startQuickChat(action.prompt)}
              className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-transparent hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-left group"
              data-testid={`quick-action-${action.label.toLowerCase().replace(/ /g, '-')}`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: `${action.color}15` }}>
                <action.icon className="w-5 h-5" style={{ color: action.color }} strokeWidth={2} />
              </div>
              <p className="text-sm font-medium text-slate-800">{action.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Journal + Calendar + Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Journal */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up delay-300" data-testid="recent-journals-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#FFB627]" /> Journal
            </h3>
            <button onClick={() => navigate('/journal')} className="text-xs text-[#FF715B] font-medium hover:underline" data-testid="view-all-journal-btn">View all</button>
          </div>
          {recentJournals.length > 0 ? (
            <div className="space-y-3">
              {recentJournals.map((j) => (
                <div key={j.entry_id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => navigate('/journal')}>
                  <p className="text-sm font-medium text-slate-800 truncate">{j.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(j.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Start your journaling journey</p>
              <button onClick={() => navigate('/journal')} className="text-sm text-[#FF715B] font-medium mt-2 hover:underline" data-testid="start-journal-btn">Write your first entry</button>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up delay-400" data-testid="upcoming-events-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#4E9FE5]" /> Upcoming
            </h3>
            <button onClick={() => navigate('/calendar')} className="text-xs text-[#FF715B] font-medium hover:underline" data-testid="view-all-events-btn">View all</button>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((e) => (
                <div key={e.event_id} className="p-3 rounded-xl bg-slate-50 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#4E9FE5]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                    <p className="text-xs text-slate-500">{new Date(e.start_time).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No upcoming events</p>
              <button onClick={() => navigate('/calendar')} className="text-sm text-[#FF715B] font-medium mt-2 hover:underline" data-testid="add-event-btn">Add an event</button>
            </div>
          )}
        </div>

        {/* Mood Insights */}
        <div className="bg-gradient-to-br from-[#4E9FE5]/5 to-[#10B981]/5 rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up delay-500" data-testid="mood-insights-card">
          <h3 className="font-['Outfit'] font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-[#10B981]" /> Mood Insights
          </h3>
          {moodInsights && moodInsights.total_entries > 0 ? (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <p className="font-['Outfit'] text-3xl font-bold text-slate-900">{moodInsights.average_mood}</p>
                  <p className="text-xs text-slate-500">Average</p>
                </div>
                <div className="text-center">
                  <p className="font-['Outfit'] text-3xl font-bold text-slate-900">{moodInsights.total_entries}</p>
                  <p className="text-xs text-slate-500">Check-ins</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  moodInsights.trend === 'improving' ? 'bg-[#10B981]/10 text-[#10B981]' :
                  moodInsights.trend === 'declining' ? 'bg-[#4E9FE5]/10 text-[#4E9FE5]' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {moodInsights.trend}
                </div>
              </div>
              <p className="text-sm text-slate-600">{moodInsights.message}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Heart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{moodInsights?.message || 'Start tracking your mood to see insights!'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Referral Section */}
      <div className="mt-6">
        <ReferralSection />
      </div>
    </div>
  );
}
