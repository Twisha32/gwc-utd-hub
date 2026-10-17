'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AdminNav } from '@/components/AdminNav';
import { Protected } from '@/components/Protected';
import { api, errorMessage, fetcher } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useUser } from '@/lib/hooks';
import type { MemberRow } from '@/lib/types';

function MembersAdmin() {
  const { user } = useUser();
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');
  const query = q.trim();
  const { data, error, mutate } = useSWR<{ users: MemberRow[] }>(
    `/users?limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    fetcher,
    { keepPreviousData: true },
  );

  async function setRole(m: MemberRow, role: 'member' | 'officer') {
    if (role === 'officer' && !window.confirm(`Make ${m.name} an officer? They'll be able to manage events, challenges and members.`)) return;
    setMessage('');
    try {
      await api(`/users/${m.id}/role`, { method: 'PUT', body: { role } });
      await mutate();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  return (
    <div className="wrap page">
      <title>Members | GWC at UTD</title>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <AdminNav />

      <div className="toolbar">
        <label htmlFor="member-search" className="sr-only">
          Search members
        </label>
        <input
          id="member-search"
          className="input"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <span className="muted small">Showing the 50 newest matches.</span>
      </div>

      {message && (
        <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      {error ? (
        <div className="form-error" role="alert">
          Members didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : data.users.length === 0 ? (
        <div className="empty">
          <h3>No one matches that</h3>
          <p>Try part of a name or an email address.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Major</th>
                <th>Joined</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name}
                    <div className="muted small">{m.email}</div>
                  </td>
                  <td>
                    {m.major ?? <span className="muted">-</span>}
                    {m.gradYear && <div className="muted small">Class of {m.gradYear}</div>}
                  </td>
                  <td>{shortDate(m.createdAt)}</td>
                  <td>{m.role === 'officer' ? <span className="pill pill--pink">Officer</span> : <span className="pill">Member</span>}</td>
                  <td className="actions">
                    {m.id === user?.id ? (
                      <span className="muted small">That&apos;s you</span>
                    ) : m.role === 'officer' ? (
                      <button className="btn btn--sm" onClick={() => setRole(m, 'member')}>
                        Remove officer
                      </button>
                    ) : (
                      <button className="btn btn--sm" onClick={() => setRole(m, 'officer')}>
                        Make officer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminMembersPage() {
  return (
    <Protected officer>
      <MembersAdmin />
    </Protected>
  );
}
