import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "@/components/Landing";
import AuthCallback from "@/components/AuthCallback";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/components/Dashboard";
import WillowChat from "@/components/WillowChat";
import Journal from "@/components/Journal";
import CalendarView from "@/components/CalendarView";
import PricingPage from "@/components/PricingPage";
import AdminDashboard from "@/components/AdminDashboard";
import CalmCorner from "@/components/CalmCorner";
import PrivacyPolicy from "@/components/PrivacyPolicy";
import TermsOfService from "@/components/TermsOfService";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5]" data-testid="loading-screen">
      <div className="text-center">
        <Loader2 className="w-10 h-10 mx-auto text-[#FF715B] animate-spin mb-3" />
        <p className="text-slate-500 font-['Figtree']">Loading HEARD...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRouter() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Synchronous check for session_id - must happen before ProtectedRoute runs
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><WillowChat /></ProtectedRoute>} />
      <Route path="/chat/:conversationId" element={<ProtectedRoute><WillowChat /></ProtectedRoute>} />
      <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
      <Route path="/calm-corner" element={<ProtectedRoute><CalmCorner /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
