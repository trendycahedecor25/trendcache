import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, TrendingUp, DollarSign, Share2, MessageCircle, BookOpen, Heart, Calendar, Crown, Award, UserPlus } from 'lucide-react';

import API from '@/config/api';

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className="font-['Outfit'] text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/admin/analytics`, { withCredentials: true });
      setAnalytics(res.data);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Admin access required' : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-10 flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-2 border-[#FF715B] border-t-transparent rounded-full" />
    </div>
  );

  if (error) return (
    <div className="p-10 text-center">
      <Crown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-600 font-medium">{error}</p>
    </div>
  );

  if (!analytics) return null;
  const { users, revenue, referrals, engagement, recent_signups } = analytics;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-6xl mx-auto" data-testid="admin-dashboard">
      <div className="mb-8">
        <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Crown className="w-7 h-7 text-[#FFB627]" /> Admin Dashboard
        </h1>
        <p className="text-slate-500 mt-1">Real-time overview of HEARD's growth</p>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="user-stats">
        <StatCard icon={Users} label="Total Users" value={users.total} sub={`+${users.new_today} today`} color="#4E9FE5" bg="bg-[#4E9FE5]/10" />
        <StatCard icon={Crown} label="On Trial" value={users.trial} sub={`${users.trial > 0 ? Math.round(users.trial / users.total * 100) : 0}% of users`} color="#FFB627" bg="bg-[#FFB627]/10" />
        <StatCard icon={Award} label="Premium" value={users.active_premium} sub="Paid subscribers" color="#10B981" bg="bg-[#10B981]/10" />
        <StatCard icon={Users} label="Free Tier" value={users.free} sub="Potential upgrades" color="#64748B" bg="bg-slate-100" />
      </div>

      {/* Growth & Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="growth-stats">
        <StatCard icon={UserPlus} label="New This Week" value={users.new_this_week} sub={`${users.new_this_month} this month`} color="#FF715B" bg="bg-[#FF715B]/10" />
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${revenue.total.toFixed(2)}`} sub={`${revenue.total_transactions} transactions`} color="#10B981" bg="bg-[#10B981]/10" />
        <StatCard icon={Share2} label="Referrals" value={referrals.total} sub={`${referrals.this_month} this month`} color="#8B5CF6" bg="bg-[#8B5CF6]/10" />
      </div>

      {/* Engagement */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="engagement-stats">
        <StatCard icon={MessageCircle} label="Conversations" value={engagement.conversations} color="#FF715B" bg="bg-[#FF715B]/10" />
        <StatCard icon={BookOpen} label="Journal Entries" value={engagement.journal_entries} color="#FFB627" bg="bg-[#FFB627]/10" />
        <StatCard icon={Heart} label="Mood Check-ins" value={engagement.mood_entries} color="#10B981" bg="bg-[#10B981]/10" />
        <StatCard icon={Calendar} label="Calendar Events" value={engagement.calendar_events} color="#4E9FE5" bg="bg-[#4E9FE5]/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="recent-signups">
          <h3 className="font-['Outfit'] font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#FF715B]" /> Recent Signups
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recent_signups.map((u) => (
              <div key={u.email || u.user_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{u.name || 'Anonymous'}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    u.subscription_status === 'trial' ? 'bg-[#FFB627]/10 text-[#FFB627]' :
                    u.subscription_status === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {u.subscription_status || 'free'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</p>
                </div>
              </div>
            ))}
            {recent_signups.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No signups yet</p>}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="top-referrers">
          <h3 className="font-['Outfit'] font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#8B5CF6]" /> Top Referrers
          </h3>
          <div className="space-y-3">
            {referrals.top_referrers.map((r, idx) => (
              <div key={r.email} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF715B] to-[#FFB627] flex items-center justify-center text-white text-xs font-bold">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-['Outfit'] font-bold text-slate-900">{r.referral_count}</p>
                  <p className="text-[10px] text-slate-400">referrals</p>
                </div>
              </div>
            ))}
            {referrals.top_referrers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No referrals yet — spread the word!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
