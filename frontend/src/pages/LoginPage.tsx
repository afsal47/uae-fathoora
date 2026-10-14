import axios from 'axios';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getAdminKey, setAdminKey, clearAdminKey, verifyAdminKey } from '../lib/api';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const stored = getAdminKey();
    if (!stored) {
      return;
    }
    let cancelled = false;
    verifyAdminKey(stored)
      .then((valid) => {
        if (cancelled) return;
        if (!valid) {
          clearAdminKey();
          return;
        }
        setAuthed(true);
      })
      .catch(() => {
        if (!cancelled) clearAdminKey();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authed) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Enter the admin API key');
      return;
    }
    setSubmitting(true);
    try {
      const valid = await verifyAdminKey(trimmed);
      if (!valid) {
        clearAdminKey();
        setError('Invalid admin API key');
        return;
      }
      setAdminKey(trimmed);
      setAuthed(true);
    } catch (err) {
      clearAdminKey();
      if (axios.isAxiosError(err) && !err.response) {
        setError('Could not reach the server. Try again.');
      } else {
        setError('Invalid admin API key');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md"
      >
        <h1 className="text-xl font-bold text-gray-900 mb-1">E-Invoice Hub Admin</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter the <code className="text-xs bg-gray-100 px-1 rounded">ADMIN_API_KEY</code> from the Hub{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">.env</code>.
        </p>
        {error && (
          <p className="text-red-600 text-sm mb-3 bg-red-50 p-3 rounded-lg">{error}</p>
        )}
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin API Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Admin API key"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-4"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export function RequireAdmin() {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const stored = getAdminKey();
    if (!stored) {
      setOk(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    verifyAdminKey(stored)
      .then((valid) => {
        if (cancelled) return;
        if (!valid) clearAdminKey();
        setOk(valid);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearAdminKey();
        setOk(false);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="text-gray-400 text-center py-16">Loading...</div>;
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
