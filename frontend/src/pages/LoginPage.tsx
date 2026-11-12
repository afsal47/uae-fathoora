import axios from 'axios';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Eye, EyeOff, Shield } from 'lucide-react';
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
    <div className="login-shell">
      <aside className="login-aside">
        <div>
          <div className="app-brand-mark">
            <Shield size={18} />
          </div>
          <h1>UAE-FATHOORA</h1>
          <p>
            Secure administration for tenants, source systems, and Peppol invoice
            submission.
          </p>
        </div>
        <p className="text-xs text-slate-500">Hub console · Access key required</p>
      </aside>

      <div className="login-main">
        <div className="login-card">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="app-brand-mark">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">UAE-FATHOORA</p>
              <p className="text-xs text-[var(--color-ink-subtle)]">Administration</p>
            </div>
          </div>

          <div>
            <h2 className="page-title">Sign in</h2>
            <p className="page-subtitle">Use the access key issued for this hub.</p>
          </div>

          {checking ? (
            <p className="mt-8 text-sm text-[var(--color-ink-subtle)]">Checking your session…</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && <p className="alert-error">{error}</p>}
              <div className="field">
                <label htmlFor="access-key" className="field-label">
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
                    className="input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                    aria-label={showKey ? 'Hide access key' : 'Show access key'}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
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
    return <div className="loading-state min-h-screen">Loading…</div>;
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
