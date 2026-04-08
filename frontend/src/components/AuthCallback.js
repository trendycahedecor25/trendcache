import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.slice(1)).get('session_id');

    // Extract referral code from the URL path/query (came through redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || '';

    if (!sessionId) {
      navigate('/', { replace: true });
      return;
    }

    axios
      .post(`${API}/auth/session`, { session_id: sessionId, referral_code: refCode || null }, { withCredentials: true })
      .then((res) => {
        // Store token in localStorage as fallback for cookie issues
        login(res.data, res.data.session_token);
        navigate('/dashboard', { state: { user: res.data }, replace: true });
      })
      .catch((err) => {
        console.error('Auth callback error:', err);
        navigate('/', { replace: true });
      });
  }, [navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5]" data-testid="auth-callback">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#FF715B] to-[#FFB627] animate-pulse mb-4" />
        <p className="text-slate-600 font-['Figtree'] text-lg">Connecting you with Willow...</p>
      </div>
    </div>
  );
}
