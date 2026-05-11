'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
      <div className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
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
  const { data: session, status: authStatus } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncError, setSyncError] = useState<string>('');

  const loadContacts = useCallback(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(d => {
        setContacts(d.contacts ?? []);
        setLoadingContacts(false);
      })
      .catch(() => setLoadingContacts(false));
  }, []);

  const runSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Starting sync…');
    setSyncError('');

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error ?? `HTTP ${res.status}`;
        setSyncError(msg);
        setSyncStatus('');
        setSyncing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setSyncError('No response body from sync endpoint');
        setSyncing(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const label = parsed.detail
              ? `${parsed.step} — ${parsed.detail}`
              : parsed.step;
            setSyncStatus(label);
            if (parsed.step === 'Error') {
              setSyncError(parsed.detail ?? 'Unknown error');
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      loadContacts();
      setSyncStatus('Sync complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(msg);
      setSyncStatus('');
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadContacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Auto-sync once session is available
  useEffect(() => {
    if (authStatus === 'authenticated' && session) {
      runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats: Stats = {
    total: contacts.length,
    active: contacts.filter(c => c.last_contact_date && new Date(c.last_contact_date) > thirtyDaysAgo).length,
    needsAction: contacts.filter(c =>
      ['Needs Response', 'Awaiting Reply', 'Gone Cold'].includes(c.true_status ?? '')
    ).length,
    goneCold: contacts.filter(c => c.true_status === 'Gone Cold').length,
    meetings: contacts.filter(c => c.meeting_happened).length,
  };

  const actionContacts = contacts
    .filter(c => ['Needs Response', 'Awaiting Reply', 'Gone Cold'].includes(c.true_status ?? ''))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.urgency ?? 'low'] ?? 2) - (order[b.urgency ?? 'low'] ?? 2);
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

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-10 fade-up" style={{ animationDelay: '0s' }}>
        <div>
          <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Your networking intelligence overview
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 mt-1">
          <button
            onClick={runSync}
            disabled={syncing}
            className="px-4 py-2 text-xs rounded border font-medium transition-all"
            style={{
              borderColor: syncing ? 'var(--border)' : 'var(--accent)',
              color: syncing ? 'var(--text-dim)' : 'var(--accent)',
              backgroundColor: syncing ? 'transparent' : 'var(--accent-soft)',
              cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>

          {syncing && syncStatus && (
            <div className="text-xs text-right max-w-48" style={{ color: 'var(--accent)', fontSize: '0.62rem' }}>
              {syncStatus}
            </div>
          )}

          {!syncing && syncError && (
            <div
              className="text-xs text-right max-w-56 p-2 rounded border"
              style={{
                color: 'var(--down)',
                borderColor: 'var(--down)',
                backgroundColor: 'rgba(139,38,53,0.08)',
                fontSize: '0.62rem',
              }}
            >
              {syncError}
            </div>
          )}

          {!syncing && syncStatus === 'Sync complete' && !syncError && (
            <div className="text-xs" style={{ color: 'var(--up)', fontSize: '0.62rem' }}>
              ✓ Sync complete
            </div>
          )}
        </div>
      </div>

      {loadingContacts ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4 mb-12">
            <StatCard value={stats.total} label="Total Contacts" delay={0.05} />
            <StatCard value={stats.active} label="Active (30d)" delay={0.1} />
            <StatCard value={stats.needsAction} label="Needs Action" delay={0.15} />
            <StatCard value={stats.goneCold} label="Gone Cold" delay={0.2} />
            <StatCard value={stats.meetings} label="Meetings Had" delay={0.25} />
          </div>

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

          {contacts.length === 0 && !syncing && (
            <div
              className="text-center py-16 rounded-lg border fade-up"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
            >
              <div className="font-display text-2xl mb-2" style={{ color: 'var(--text)' }}>
                No contacts yet
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Click &ldquo;Sync Now&rdquo; to read your Google Sheet and Gmail.
              </p>
              <button
                onClick={runSync}
                className="px-6 py-2.5 text-sm rounded font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#0C0C0A' }}
              >
                Sync Now
              </button>
            </div>
          )}

          {contacts.length > 0 && (
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
          )}
        </>
      )}
    </AppLayout>
  );
}
