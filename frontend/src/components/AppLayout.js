import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, MessageCircle, BookOpen, Calendar, LogOut, Menu, X, Crown, BarChart3, Flower2 } from 'lucide-react';
import { useState } from 'react';

const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageCircle, label: 'Chat with Willow' },
  { to: '/calm-corner', icon: Flower2, label: 'Calm Corner' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/pricing', icon: Crown, label: 'Premium' },
];

const adminNavItem = { to: '/admin', icon: BarChart3, label: 'Admin' };

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-sm font-medium ${
      isActive
        ? 'bg-[#FF715B]/10 text-[#FF715B]'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-white border-r border-slate-100 z-40" data-testid="sidebar">
        <div className="p-6 flex items-center gap-3">
          <img src={WILLOW_AVATAR} alt="HEARD" className="w-10 h-10 rounded-full" />
          <h1 className="font-['Outfit'] font-bold text-xl gradient-text">HEARD</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} data-testid={`nav-${item.label.toLowerCase().replace(/ /g, '-')}`}>
              <item.icon className="w-5 h-5" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink to={adminNavItem.to} className={linkClass} data-testid="nav-admin">
              <adminNavItem.icon className="w-5 h-5" strokeWidth={2} />
              {adminNavItem.label}
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#FF715B]/10 flex items-center justify-center text-[#FF715B] text-sm font-bold">
                {user?.name?.[0] || 'M'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'Mom'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 w-full text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-40 flex items-center justify-between px-4" data-testid="mobile-header">
        <div className="flex items-center gap-2">
          <img src={WILLOW_AVATAR} alt="HEARD" className="w-8 h-8 rounded-full" />
          <span className="font-['Outfit'] font-bold text-lg gradient-text">HEARD</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl hover:bg-slate-50" data-testid="mobile-menu-toggle">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-['Outfit'] font-bold text-lg gradient-text">HEARD</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-slate-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileMenuOpen(false)} data-testid={`mobile-nav-${item.label.toLowerCase().replace(/ /g, '-')}`}>
                  <item.icon className="w-5 h-5" strokeWidth={2} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all" data-testid="mobile-logout-button">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40 flex items-center justify-around py-2 px-2" data-testid="bottom-nav">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-[#FF715B]' : 'text-slate-400'
              }`}
              data-testid={`bottom-nav-${item.label.toLowerCase().replace(/ /g, '-')}`}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
