'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ContactCard from '@/components/ui/ContactCard';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Contact } from '@/types';

interface Stats {
  total: number;
  active: number;
  needsAction: number;
  goneCold: number;
  meetings: number;
}

function StatCard({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <div
      className="fade-up p-5 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
        borderTop: '1px solid var(--accent)',
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="font-display text-4xl font-light"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </div>
      <div
        className="section-header text-xs mt-2"
        style={{ fontSize: '0.62rem', letterSpacing: '0.12em', paddingBottom: 0 }}
      >
        {label}
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats: Stats = {
    total: contacts.length,
    active: contacts.filter(c => c.last_contact_date && new Date(c.last_contact_date) > thirtyDaysAgo).length,
    needsAction: contacts.filter(c =>
      c.true_status === 'Needs Response' ||
      c.true_status === 'Awaiting Reply' ||
      c.true_status === 'Gone Cold'
    ).length,
    goneCold: contacts.filter(c => c.true_status === 'Gone Cold').length,
    meetings: contacts.filter(c => c.meeting_happened).length,
  };

  const actionContacts = contacts
    .filter(c => ['Needs Response', 'Awaiting Reply', 'Gone Cold'].includes(c.true_status ?? ''))
    .sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      const aU = urgencyOrder[a.urgency ?? 'low'] ?? 2;
      const bU = urgencyOrder[b.urgency ?? 'low'] ?? 2;
      return aU - bU;
    })
    .slice(0, 6);

  const recentMeetings = contacts
    .filter(c => c.meeting_happened)
    .sort((a, b) => {
      if (!a.meeting_date && !b.meeting_date) return 0;
      if (!a.meeting_date) return 1;
      if (!b.meeting_date) return -1;
      return new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime();
    })
    .slice(0, 4);

  const byRegion = {
    Dubai: contacts.filter(c => c.region === 'Dubai'),
    London: contacts.filter(c => c.region === 'London'),
    Other: contacts.filter(c => !c.region || c.region === 'Other'),
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Page header */}
      <div className="mb-10 fade-up" style={{ animationDelay: '0s' }}>
        <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Your networking intelligence overview
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4 mb-12">
        <StatCard value={stats.total} label="Total Contacts" delay={0.05} />
        <StatCard value={stats.active} label="Active (30d)" delay={0.1} />
        <StatCard value={stats.needsAction} label="Needs Action" delay={0.15} />
        <StatCard value={stats.goneCold} label="Gone Cold" delay={0.2} />
        <StatCard value={stats.meetings} label="Meetings Had" delay={0.25} />
      </div>

      {/* Action Required */}
      {actionContacts.length > 0 && (
        <section className="mb-12">
          <div className="mb-6">
            <div className="section-header">Action Required</div>
          </div>
          <div className="space-y-3">
            {actionContacts.map((c, i) => (
              <ContactCard key={c.id} contact={c} delay={0.05 * i} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Meetings */}
      {recentMeetings.length > 0 && (
        <section className="mb-12">
          <div className="mb-6">
            <div className="section-header">Recent Meetings</div>
          </div>
          <div className="space-y-3">
            {recentMeetings.map((c, i) => (
              <div
                key={c.id}
                className="contact-card p-4 rounded-lg border fade-up"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  animationDelay: `${0.05 * i}s`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl" style={{ color: 'var(--text)' }}>
                        {c.name}
                      </span>
                      <StatusBadge status={c.true_status} />
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {c.company}
                      {c.role && <span style={{ color: 'var(--text-dim)' }}> · {c.role}</span>}
                    </div>
                    {c.ai_summary && (
                      <p className="text-sm mt-2" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {c.ai_summary}
                      </p>
                    )}
                  </div>
                  {c.meeting_date && (
                    <span
                      className="text-xs shrink-0"
                      style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
                    >
                      {new Date(c.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* By Region */}
      <section>
        <div className="mb-6">
          <div className="section-header">By Region</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(byRegion).map(([region, regionContacts], i) => (
            <div
              key={region}
              className="p-4 rounded-lg border fade-up"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                animationDelay: `${0.05 * i}s`,
              }}
            >
              <div className="font-display text-2xl" style={{ color: 'var(--text)' }}>
                {regionContacts.length}
              </div>
              <div className="section-header text-xs mt-1" style={{ fontSize: '0.62rem', paddingBottom: 0 }}>
                {region}
              </div>
              <div className="mt-3 space-y-1">
                {['Needs Response', 'Awaiting Reply', 'Gone Cold'].map(status => {
                  const count = regionContacts.filter(c => c.true_status === status).length;
                  if (count === 0) return null;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <StatusBadge status={status} />
                      <span
                        className="text-xs"
                        style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
