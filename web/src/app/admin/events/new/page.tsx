'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { EventForm } from '@/components/EventForm';
import { Protected } from '@/components/Protected';

function NewEvent() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  return (
    <div className="wrap page">
      <title>New event | GWC at UTD</title>
      <p style={{ marginBottom: 20 }}>
        <Link href="/admin/events">All events</Link>
      </p>
      <div className="page-head">
        <h1>New event</h1>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <EventForm
          submitLabel="Create event"
          onSaved={async (event) => {
            await mutate((key) => typeof key === 'string' && key.startsWith('/events'));
            router.push(`/admin/events/${event.id}`);
          }}
        />
      </div>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Protected officer>
      <NewEvent />
    </Protected>
  );
}
