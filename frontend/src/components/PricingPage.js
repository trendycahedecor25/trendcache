import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, MessageCircle, BookOpen, Calendar, Heart, Zap, Crown } from 'lucide-react';
import axios from 'axios';
import { useState } from 'react';

import API from '@/config/api';
const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

const freeFeatures = [
  { text: '3 Willow messages per day', icon: MessageCircle },
  { text: 'Basic journal', icon: BookOpen },
  { text: 'Calendar & events', icon: Calendar },
  { text: 'Mood check-ins', icon: Heart },
];

const premiumFeatures = [
  { text: 'Unlimited Willow conversations', icon: MessageCircle },
  { text: 'AI journaling prompts', icon: Sparkles },
  { text: 'Full mood insights & trends', icon: Heart },
  { text: 'Meal planning help', icon: Zap },
  { text: 'Homework & activity ideas', icon: BookOpen },
  { text: 'Calendar & scheduling', icon: Calendar },
  { text: 'Emotional pattern tracking', icon: Crown },
  { text: 'Priority support', icon: Check },
];

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const subscription = user?.subscription;
  const isPremium = subscription?.is_premium;

  const handleSubscribe = async () => {
    if (!user) {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/pricing';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/subscribe/checkout`, {
        origin_url: window.location.origin
      }, { withCredentials: true });
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Checkout error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto" data-testid="pricing-page">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-[#FFB627]/10 px-4 py-2 rounded-full mb-4">
          <Crown className="w-4 h-4 text-[#FFB627]" />
          <span className="text-sm font-medium text-[#FFB627]">Simple, affordable pricing</span>
        </div>
        <h1 className="font-['Outfit'] text-3xl md:text-4xl font-black text-slate-900 mb-3">
          Invest in yourself, mama
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Because the support you deserve shouldn't break the bank.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free Plan */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="free-plan-card">
          <h3 className="font-['Outfit'] text-lg font-semibold text-slate-900 mb-1">Free</h3>
          <p className="text-slate-500 text-sm mb-4">Get a taste of what HEARD can do</p>
          <div className="mb-6">
            <span className="font-['Outfit'] text-4xl font-black text-slate-900">$0</span>
            <span className="text-slate-400 text-sm ml-1">/forever</span>
          </div>
          <div className="space-y-3 mb-8">
            {freeFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-3 h-3 text-slate-500" />
                </div>
                <span className="text-sm text-slate-600">{f.text}</span>
              </div>
            ))}
          </div>
          {!isPremium && (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-all"
              data-testid="free-plan-btn"
            >
              Current Plan
            </button>
          )}
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-[#FF715B]/5 to-[#FFB627]/5 rounded-3xl p-8 border-2 border-[#FF715B]/20 shadow-[0_8px_30px_rgba(255,113,91,0.1)] relative" data-testid="premium-plan-card">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FF715B] to-[#FFB627] text-white text-xs font-bold px-4 py-1 rounded-full">
            MOST POPULAR
          </div>
          <div className="flex items-center gap-3 mb-1">
            <img src={WILLOW_AVATAR} alt="Willow" className="w-8 h-8 rounded-full" />
            <h3 className="font-['Outfit'] text-lg font-semibold text-slate-900">Premium</h3>
          </div>
          <p className="text-slate-500 text-sm mb-4">Full access to Willow & all features</p>
          <div className="mb-2">
            <span className="font-['Outfit'] text-4xl font-black text-slate-900">$4.99</span>
            <span className="text-slate-400 text-sm ml-1">/month</span>
          </div>
          <p className="text-[#10B981] text-xs font-medium mb-6">7-day free trial included</p>
          <div className="space-y-3 mb-8">
            {premiumFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#FF715B]/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-3 h-3 text-[#FF715B]" />
                </div>
                <span className="text-sm text-slate-700 font-medium">{f.text}</span>
              </div>
            ))}
          </div>

          {isPremium ? (
            <div className="w-full py-3 rounded-2xl bg-[#10B981]/10 text-[#10B981] font-medium text-sm text-center" data-testid="premium-active-badge">
              <Check className="w-4 h-4 inline mr-1" />
              {subscription?.status === 'trial' ? `Trial: ${subscription.days_left} days left` : 'Active Premium Member'}
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-[#FF715B] text-white font-semibold text-sm hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.39)] hover:shadow-[0_6px_20px_rgba(255,113,91,0.23)] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="subscribe-btn"
            >
              {loading ? 'Redirecting...' : 'Start Free Trial'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto" data-testid="pricing-faq">
        <h2 className="font-['Outfit'] text-xl font-bold text-slate-900 text-center mb-8">Questions?</h2>
        <div className="space-y-4">
          {[
            { q: "What happens during the free trial?", a: "You get full access to everything — unlimited Willow conversations, AI prompts, mood insights, and all features. No credit card required to browse, and you can upgrade anytime." },
            { q: "Can I cancel anytime?", a: "Absolutely. No commitments, no hidden fees. You can manage your subscription at any time." },
            { q: "What if I can't afford it right now?", a: "We get it, truly. The free tier gives you 3 Willow conversations a day, basic journal, and calendar — you're always welcome here." },
            { q: "Is my data private?", a: "100%. Your conversations with Willow, journal entries, and personal data are encrypted and never shared. Your safe space stays safe." },
          ].map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100">
              <h3 className="font-['Outfit'] font-semibold text-slate-900 text-sm mb-1">{faq.q}</h3>
              <p className="text-sm text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
