import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Heart, MessageCircle, BookOpen, Calendar, Sparkles, ArrowRight, Shield, Clock } from 'lucide-react';

const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";
const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/0464a7efb70cd6cf856c4c9086f7fbee5ebb4127c508bf3e5cdc954d3b3bfae0.png";

const features = [
  {
    icon: MessageCircle,
    title: "Meet Willow",
    description: "Your always-there AI companion who listens first, validates your feelings, and helps with the daily chaos.",
    color: "#FF715B",
    bg: "from-[#FF715B]/10 to-[#FF715B]/5"
  },
  {
    icon: BookOpen,
    title: "Journal & Reflect",
    description: "Write it out with guided prompts designed to help you process, celebrate, and grow.",
    color: "#FFB627",
    bg: "from-[#FFB627]/10 to-[#FFB627]/5"
  },
  {
    icon: Calendar,
    title: "Stay Organized",
    description: "Calendar, reminders, and scheduling help so nothing slips through the cracks.",
    color: "#4E9FE5",
    bg: "from-[#4E9FE5]/10 to-[#4E9FE5]/5"
  },
  {
    icon: Heart,
    title: "Track Your Wellness",
    description: "Monitor your emotional patterns. Willow learns your baseline and checks in when things shift.",
    color: "#10B981",
    bg: "from-[#10B981]/10 to-[#10B981]/5"
  },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleGetStarted = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    // Capture referral code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || '';
    const redirectUrl = window.location.origin + '/dashboard' + (refCode ? `?ref=${refCode}` : '');
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100/50" data-testid="landing-nav">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={WILLOW_AVATAR} alt="HEARD" className="w-8 h-8 rounded-full" />
            <span className="font-['Outfit'] font-bold text-xl gradient-text">HEARD</span>
          </div>
          <button
            onClick={handleGetStarted}
            className="bg-[#FF715B] text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.3)] hover:shadow-[0_6px_20px_rgba(255,113,91,0.2)] hover:-translate-y-0.5 transition-all duration-200"
            data-testid="nav-get-started-btn"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 opacity-20">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-100 mb-6">
                <Sparkles className="w-4 h-4 text-[#FFB627]" />
                <span className="text-sm text-slate-600 font-medium">AI-powered companion for moms</span>
              </div>
              <h1 className="font-['Outfit'] text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.05] mb-6">
                You deserve<br />to be <span className="gradient-text">HEARD</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                Meet <strong className="text-[#FF715B]">Willow</strong> — your always-there AI companion who listens first,
                validates your feelings, and helps with the beautiful chaos of motherhood.
                Because no mom should do this alone.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleGetStarted}
                  className="bg-[#FF715B] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.39)] hover:shadow-[0_6px_20px_rgba(255,113,91,0.23)] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                  data-testid="hero-get-started-btn"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#10B981]" /> Private & Safe</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#4E9FE5]" /> Always Available</div>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in-up delay-200 hidden lg:block">
              <div className="relative w-80 h-80 mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF715B]/20 to-[#FFB627]/20 rounded-full blur-3xl" />
                <img src={WILLOW_AVATAR} alt="Willow" className="relative w-full h-full object-contain animate-float willow-glow rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" data-testid="features-section">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need, in one warm space
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              HEARD combines emotional support with practical help — because being a mom means juggling both.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`animate-fade-in-up delay-${(i + 1) * 100} bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(255,113,91,0.08)] hover:-translate-y-1 transition-all duration-300 group`}
                data-testid={`feature-card-${i}`}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} strokeWidth={2} />
                </div>
                <h3 className="font-['Outfit'] font-semibold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#FF715B]/5 to-[#FFB627]/5" data-testid="philosophy-section">
        <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#FF715B] to-[#FFB627] flex items-center justify-center mb-8">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </div>
          <blockquote className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-slate-900 leading-snug mb-6">
            "You're not failing. You're doing something incredibly hard, and you're still here. That makes you amazing."
          </blockquote>
          <p className="text-slate-500 text-lg mb-10">— Willow, your HEARD companion</p>
          <button
            onClick={handleGetStarted}
            className="bg-[#FF715B] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.39)] hover:shadow-[0_6px_20px_rgba(255,113,91,0.23)] hover:-translate-y-0.5 transition-all duration-200 inline-flex items-center gap-2"
            data-testid="cta-get-started-btn"
          >
            Start Your Journey
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <img src={WILLOW_AVATAR} alt="HEARD" className="w-5 h-5 rounded-full" />
            <span className="font-['Outfit'] font-semibold">HEARD</span>
          </div>
          <p>Made with love for every mom doing her best.</p>
        </div>
      </footer>
    </div>
  );
}
