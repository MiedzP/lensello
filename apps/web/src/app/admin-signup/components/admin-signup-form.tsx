'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createOwnerAccount } from '../actions';

export default function AdminSignupForm() {
  const [fullName, setFullName] = useState('Michael Pagano');
  const [email, setEmail] = useState('michael.pagano@xerensys.ai');
  const [password, setPassword] = useState('Lensello2026');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await createOwnerAccount({
        full_name: fullName,
        email: email.toLowerCase(),
        password,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Failed to create account. Try again.');
      console.error(err);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 rounded-lg bg-green-50 p-6 border border-green-200">
        <h2 className="text-lg font-bold text-green-900">✓ Account Created!</h2>
        <p className="text-sm text-green-800">
          Your owner account has been created. You can now log in with your credentials.
        </p>
        <div className="space-y-2 text-sm text-green-800 bg-white p-4 rounded border border-green-200">
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Password:</strong> {password}</p>
        </div>
        <a
          href="/login"
          className="block w-full text-center px-4 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700"
        >
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Full Name *
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:outline-none text-sm"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:outline-none text-sm"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Password (12+ characters) *
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:outline-none text-sm"
          placeholder="••••••••••••"
        />
        <p className="text-xs text-slate-500 mt-1">Use letters, numbers, and symbols</p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="lg"
        className="w-full"
      >
        {loading ? 'Creating account...' : 'Create Owner Account'}
      </Button>
    </form>
  );
}
