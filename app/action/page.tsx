'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ContactCard from '@/components/ui/ContactCard';
import type { Contact } from '@/types';

function UrgencySection({
  title,
  contacts,
  color,
  dot,
  startDelay,
}: {
  title: string;
  contacts: Contact[];
  color: string;
  dot: string;
  startDelay: number;
}) {
  if (contacts.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        <span style={{ color: dot, fontSize: '0.7rem' }}>●</span>
        <div className="section-header" style={{ color }}>{title}</div>
        <span
          className="text-xs ml-auto"
          style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
        >
          {contacts.length}
        </span>
      </div>
      <div className="space-y-3">
        {contacts.map((c, i) => (
          <ContactCard key={c.id} contact={c} delay={startDelay + 0.04 * i} />
        ))}
      </div>
    </section>
  );
}

export default function ActionPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(d => {
        setContacts(d.contacts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();

  const needsResponse = contacts.filter(c => c.true_status === 'Needs Response');
  const awaitingNoFollowUp = contacts.filter(c => {
    if (c.true_status !== 'Awaiting Reply') return false;
    if (!c.last_contact_date) return false;
    const days = Math.floor((now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 7;
  });

  const high = [...needsResponse, ...awaitingNoFollowUp].filter(
    (c, i, arr) => arr.findIndex(x => x.id === c.id) === i
  );

  const medium = contacts.filter(c => {
    if (c.true_status !== 'Gone Cold') return false;
    if (!c.last_contact_date) return false;
    const days = Math.floor((now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 14 && days < 30 && c.emails_received > 0;
  });

  const low = contacts.filter(c => {
    if (!c.last_contact_date) return false;
    const days = Math.floor((now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 30 && c.emails_received > 0 &&
      !['Recent Meeting', 'Opportunity Active'].includes(c.true_status ?? '');
  });

  const total = high.length + medium.length + low.length;

  return (
    <AppLayout>
      <div className="mb-10 fade-up">
        <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
          Needs Action
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {total} contacts requiring attention
        </p>
      </div>

      {loading ? (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : total === 0 ? (
        <div
          className="text-center py-16 rounded-lg border fade-up"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="font-display text-2xl mb-2" style={{ color: 'var(--text)' }}>
            All clear
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No contacts require action right now.
          </p>
        </div>
      ) : (
        <>
          <UrgencySection
            title="High Urgency"
            contacts={high}
            color="var(--down)"
            dot="var(--down)"
            startDelay={0.05}
          />
          <UrgencySection
            title="Medium Urgency"
            contacts={medium}
            color="var(--accent)"
            dot="var(--accent)"
            startDelay={0.05 + 0.04 * high.length}
          />
          <UrgencySection
            title="Low Urgency"
            contacts={low}
            color="var(--text-muted)"
            dot="var(--text-dim)"
            startDelay={0.05 + 0.04 * (high.length + medium.length)}
          />
        </>
      )}
    </AppLayout>
  );
}
