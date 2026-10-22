import axios from 'axios';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getAdminKey, setAdminKey, clearAdminKey, verifyAdminKey } from '../lib/api';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(() => Boolean(getAdminKey()));

  useEffect(() => {
    const stored = getAdminKey();
    if (!stored) {
      return;
    }
    setAuthed(true);
    setChecking(false);
  }, []);

  if (authed) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Enter your access key to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const valid = await verifyAdminKey(trimmed);
      if (!valid) {
        clearAdminKey();
        setError('That access key was not accepted.');
        return;
      }
      setAdminKey(trimmed);
      setAuthed(true);
    } catch (err) {
      clearAdminKey();
      if (axios.isAxiosError(err) && !err.response) {
        setError('The hub is unavailable. Try again in a moment.');
      } else {
        setError('That access key was not accepted.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">UAE-FATHOORA</p>
            <p className="text-xs text-slate-500">Administration</p>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use the access key issued for this hub.
        </p>

        {checking ? (
          <p className="mt-8 text-sm text-slate-400">Checking your session…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="access-key" className="block text-sm font-medium text-slate-700 mb-1.5">
                Access key
              </label>
              <div className="relative">
                <input
                  id="access-key"
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  className="w-full border border-slate-300 bg-white rounded-lg pl-3 pr-11 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showKey ? 'Hide access key' : 'Show access key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function RequireAdmin() {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(Boolean(getAdminKey()));
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (!ok) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function logoutAdmin() {
  clearAdminKey();
  window.location.href = '/login';
}
