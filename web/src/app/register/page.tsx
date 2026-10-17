'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TextField } from '@/components/fields';
import { api, ApiError, errorMessage } from '@/lib/api';
import { club } from '@/lib/club';
import { useUser } from '@/lib/hooks';
import { safeNext } from '@/lib/nav';

function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { user, refresh } = useUser();

  const [form, setForm] = useState({ name: '', email: '', password: '', joinCode: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next ?? '/events');
  }, [user, next, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { ...form, joinCode: form.joinCode || undefined },
      });
      await refresh(res, { revalidate: false });
      router.replace(next ?? '/events');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Join the club</h1>
      <p className="muted">Make an account to RSVP, check in and play the CTF.</p>
      <form onSubmit={onSubmit} noValidate>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <TextField
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={set('name')}
          error={fields.name}
          required
        />
        <TextField
          label="School email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={fields.email}
          hint={club.emailDomain ? `Use your @${club.emailDomain} address.` : undefined}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={fields.password}
          hint="At least 8 characters."
          required
        />
        <TextField
          label="Join code"
          optional
          autoComplete="off"
          value={form.joinCode}
          onChange={set('joinCode')}
          error={fields.joinCode}
          hint="If an officer gave you one at a meeting, enter it here."
        />
        <button className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="auth-alt">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="wrap page">
      <title>Join | GWC at UTD</title>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
