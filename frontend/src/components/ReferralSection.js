import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Share2, Copy, Check, Gift, Users, Heart } from 'lucide-react';

import API from '@/config/api';

export default function ReferralSection() {
  const { user } = useAuth();
  const [referralInfo, setReferralInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    axios.get(`${API}/referral/info`, { withCredentials: true })
      .then((res) => setReferralInfo(res.data))
      .catch(console.error);
  }, []);

  if (!referralInfo) return null;

  const referralLink = `${window.location.origin}?ref=${referralInfo.referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HEARD - You Deserve to be Heard',
          text: "I found this amazing app that's helped me so much as a mom. Willow is like having a supportive friend who's always there. Try it free!",
          url: referralLink
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#FF715B]/5 rounded-3xl p-6 border border-[#8B5CF6]/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="referral-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="font-['Outfit'] font-semibold text-slate-900">Share HEARD, Get a Free Month</h3>
          <p className="text-xs text-slate-500">You and your friend both get 30 days free Premium</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
          <Users className="w-4 h-4 text-[#8B5CF6]" />
          <div>
            <p className="font-['Outfit'] font-bold text-slate-900 text-sm">{referralInfo.referral_count}</p>
            <p className="text-[10px] text-slate-400">Referrals</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
          <Heart className="w-4 h-4 text-[#FF715B]" />
          <div>
            <p className="font-['Outfit'] font-bold text-slate-900 text-sm">{referralInfo.referral_count * 30}</p>
            <p className="text-[10px] text-slate-400">Free days earned</p>
          </div>
        </div>
      </div>

      {/* Link + Actions */}
      <div className="bg-white rounded-xl p-3 flex items-center gap-2 mb-3">
        <input
          type="text"
          value={referralLink}
          readOnly
          className="flex-1 text-xs text-slate-600 bg-transparent outline-none truncate"
          data-testid="referral-link-input"
        />
        <button
          onClick={copyLink}
          className={`p-2 rounded-lg transition-all ${copied ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
          data-testid="copy-referral-btn"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <button
        onClick={shareLink}
        className="w-full py-3 rounded-2xl bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#7C3AED] shadow-[0_4px_14px_0_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-2"
        data-testid="share-referral-btn"
      >
        <Share2 className="w-4 h-4" /> Share with a Mom Who Needs This
      </button>

      {/* Referral History */}
      {referralInfo.referrals.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-[#8B5CF6] font-medium hover:underline"
            data-testid="toggle-referral-details"
          >
            {showDetails ? 'Hide' : 'Show'} referral history ({referralInfo.referrals.length})
          </button>
          {showDetails && (
            <div className="mt-2 space-y-2">
              {referralInfo.referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700 font-medium">{r.name}</span>
                  <span className="text-[10px] text-slate-400">{r.date ? new Date(r.date).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
