'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TextField } from '@/components/fields';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { safeNext } from '@/lib/nav';

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { user, refresh } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next ?? '/events');
  }, [user, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email, password } });
      await refresh(res, { revalidate: false });
      router.replace(next ?? '/events');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? err.message : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Sign in</h1>
      <p className="muted">Use the email you signed up with.</p>
      <form onSubmit={onSubmit} noValidate>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="auth-alt">
        New here? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>Create an account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap page">
      <title>Sign in | GWC at UTD</title>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
