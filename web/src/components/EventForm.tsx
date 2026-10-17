'use client';

import { useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { fromInputValue, toInputValue } from '@/lib/format';
import type { EventItem } from '@/lib/types';
import { TextAreaField, TextField } from './fields';

const HOUR = 3_600_000;

export function EventForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial?: EventItem;
  submitLabel: string;
  onSaved: (event: EventItem) => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    location: initial?.location ?? '',
    startsAt: initial ? toInputValue(initial.startsAt) : '',
    endsAt: initial ? toInputValue(initial.endsAt) : '',
    capacity: initial?.capacity?.toString() ?? '',
    description: initial?.description ?? '',
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // picking a start time fills in an end an hour later if there isn't a sensible one yet
  function onStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    const startsAt = e.target.value;
    setForm((f) => {
      let endsAt = f.endsAt;
      if (startsAt && (!endsAt || endsAt <= startsAt)) {
        endsAt = toInputValue(new Date(new Date(fromInputValue(startsAt)).getTime() + HOUR).toISOString());
      }
      return { ...f, startsAt, endsAt };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFields({});

    if (!form.startsAt || !form.endsAt) {
      setFields({
        ...(form.startsAt ? {} : { startsAt: 'Pick a start time.' }),
        ...(form.endsAt ? {} : { endsAt: 'Pick an end time.' }),
      });
      return;
    }

    setBusy(true);
    try {
      const body = {
        title: form.title,
        location: form.location,
        description: form.description,
        startsAt: fromInputValue(form.startsAt),
        endsAt: fromInputValue(form.endsAt),
        capacity: form.capacity === '' ? null : Number(form.capacity),
      };
      const res = initial
        ? await api(`/events/${initial.id}`, { method: 'PATCH', body })
        : await api('/events', { method: 'POST', body });
      onSaved(res.event);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="form-grid">
        <div className="full">
          <TextField label="Title" value={form.title} onChange={set('title')} error={fields.title} required />
        </div>
        <TextField
          label="Starts"
          type="datetime-local"
          value={form.startsAt}
          onChange={onStartChange}
          error={fields.startsAt}
          hint="Times are in Central."
        />
        <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} error={fields.endsAt} />
        <TextField label="Location" value={form.location} onChange={set('location')} error={fields.location} placeholder="ECSW 1.315" />
        <TextField
          label="Capacity"
          type="number"
          min={1}
          optional
          value={form.capacity}
          onChange={set('capacity')}
          error={fields.capacity}
          hint="Leave empty for no limit. Extra RSVPs join a waitlist."
        />
        <div className="full">
          <TextAreaField
            label="Description"
            optional
            value={form.description}
            onChange={set('description')}
            error={fields.description}
          />
        </div>
        {error && (
          <div className="full form-error" role="alert">
            {error}
          </div>
        )}
        <div className="full form-actions">
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
