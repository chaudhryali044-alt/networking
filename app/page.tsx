'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import EmailDraftModal from '@/components/ui/EmailDraftModal';
import type { Contact } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

function gmailLink(email: string): string {
  return `https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(email)}+OR+to%3A${encodeURIComponent(email)}`;
}

const NEEDS_ACTION_STATUSES = ['Replied — Follow Up Needed', 'Awaiting Reply'];
const ALL_STATUSES = [
  'Meeting Confirmed', 'Active', 'Replied — Follow Up Needed',
  'Awaiting Reply', 'No Response', 'Gone Cold',
];

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div
      className="p-5 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
        borderTop: `2px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <div className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-xs mt-2" style={{ color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
        {label}
      </div>
    </div>
  );
}

// ── Contact card ──────────────────────────────────────────────────────────────

function ContactCard({
  contact,
  onDraft,
}: {
  contact: Contact;
  onDraft: (c: Contact) => void;
}) {
  const sent = contact.emails_sent ?? 0;
  const replies = contact.emails_received ?? 0;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xl" style={{ color: 'var(--text)' }}>{contact.name}</span>
              <StatusBadge status={contact.true_status} />
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              {contact.email}
              {contact.company && <span style={{ color: 'var(--text-dim)' }}> · {contact.company}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <a
              href={gmailLink(contact.email ?? '')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs rounded border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              Gmail ↗
            </a>
            <button
              onClick={() => onDraft(contact)}
              className="px-2.5 py-1 text-xs rounded border transition-colors"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
            >
              Draft ✦
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-2.5" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
          <span>First: {fmtDate(contact.first_contact_date)}</span>
          <span>Last: {fmtDate(contact.last_contact_date)}</span>
          <span
            style={{ color: replies > 0 ? 'var(--up)' : 'var(--text-dim)' }}
          >
            {sent} sent · {replies} {replies === 1 ? 'reply' : 'replies'}
          </span>
          {contact.meeting_happened && (
            <span style={{ color: 'var(--accent)' }}>◉ Meeting</span>
          )}
        </div>

        {/* Snippet */}
        {contact.thread_snippet && (
          <div
            className="mt-2 text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}
          >
            {contact.thread_snippet}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sync banner ──────────────────────────────────────────────────────────────

function SyncBanner({ status, error }: { status: string; error: string }) {
  if (!status && !error) return null;
  return (
    <div
      className="rounded-lg border px-4 py-3 mb-8 flex items-center gap-3"
      style={{
        backgroundColor: error ? 'rgba(139,38,53,0.08)' : 'var(--bg-card)',
        borderColor: error ? 'var(--down)' : 'var(--accent)',
      }}
    >
      {!error && <span className="animate-pulse" style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>◉</span>}
      <span className="text-sm" style={{ color: error ? 'var(--down)' : 'var(--text-muted)' }}>
        {error || status}
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncSummary, setSyncSummary] = useState('');
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [sortBy, setSortBy] = useState<'last_contact_date' | 'name' | 'status'>('last_contact_date');
  const didAutoSync = useRef(false);

  const loadContacts = useCallback(async () => {
    setLoadingData(true);
    const res = await fetch('/api/contacts').then(r => r.json()).catch(() => ({ contacts: [] }));
    setContacts(res.contacts ?? []);
    setLoadingData(false);
  }, []);

  const runSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Starting sync…');
    setSyncError('');
    setSyncSummary('');

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncError(data.error ?? `HTTP ${res.status}`);
        setSyncing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setSyncError('No response body'); setSyncing(false); return; }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
          try {
            const parsed = JSON.parse(line);
            const label = parsed.detail ? `${parsed.step} — ${parsed.detail}` : parsed.step;
            setSyncStatus(label);
            if (parsed.step === 'Error') setSyncError(parsed.detail ?? 'Unknown error');
            if (parsed.step === 'Sync complete!') setSyncSummary(parsed.detail ?? '');
          } catch { /* ignore */ }
        }
      }

      const now = new Date().toISOString();
      localStorage.setItem('orbitLastSync', now);
      window.dispatchEvent(new CustomEvent('orbitSyncComplete', { detail: now }));
      await loadContacts();
      setSyncStatus('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setSyncStatus('');
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadContacts]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Auto-sync once per calendar day
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session || didAutoSync.current) return;
    didAutoSync.current = true;
    const stored = localStorage.getItem('orbitLastSync');
    if (stored) {
      const d = new Date(stored);
      const today = new Date();
      const sameDay = d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
      if (sameDay) {
        console.log('[Dashboard] Already synced today — skipping auto-sync');
        return;
      }
    }
    runSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // ── Derived data ───────────────────────────────────────────────────────
  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map(s => [s, contacts.filter(c => c.true_status === s).length])
  );

  const needsAction = contacts.filter(c => NEEDS_ACTION_STATUSES.includes(c.true_status ?? ''));
  const recentActive = contacts.filter(c => c.true_status === 'Active');

  const sortedContacts = [...contacts].sort((a, b) => {
    if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
    if (sortBy === 'status') {
      return ALL_STATUSES.indexOf(a.true_status ?? '') - ALL_STATUSES.indexOf(b.true_status ?? '');
    }
    return new Date(b.last_contact_date ?? 0).getTime() - new Date(a.last_contact_date ?? 0).getTime();
  });

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 fade-up" style={{ animationDelay: '0s' }}>
        <div>
          <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Gmail-powered networking intelligence</p>
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
          {syncSummary && !syncing && !syncError && (
            <div className="text-xs" style={{ color: 'var(--up)', fontSize: '0.62rem' }}>
              ✓ {syncSummary}
            </div>
          )}
        </div>
      </div>

      {(syncing || syncError) && (
        <SyncBanner status={syncing ? syncStatus : ''} error={syncError} />
      )}

      {loadingData && !syncing ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        </div>
      ) : contacts.length === 0 && !syncing ? (
        <div
          className="text-center py-16 rounded-lg border fade-up"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="font-display text-2xl mb-2" style={{ color: 'var(--text)' }}>No contacts yet</div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Click &ldquo;Sync Now&rdquo; to scan the last 10 months of Gmail.
          </p>
          <button
            onClick={runSync}
            className="px-6 py-2.5 text-sm rounded font-medium"
            style={{ backgroundColor: 'var(--accent)', color: '#0C0C0A' }}
          >
            Sync Now
          </button>
        </div>
      ) : (
        <div className="space-y-10">

          {/* ── Stats ── */}
          <section className="fade-up" style={{ animationDelay: '0.05s' }}>
            <div className="grid grid-cols-6 gap-3">
              <StatCard value={contacts.length} label="Total Contacts" accent />
              <StatCard value={statusCounts['Active'] ?? 0} label="Active" />
              <StatCard value={needsAction.length} label="Needs Action" />
              <StatCard value={statusCounts['No Response'] ?? 0} label="No Response" />
              <StatCard value={statusCounts['Gone Cold'] ?? 0} label="Gone Cold" />
              <StatCard value={statusCounts['Meeting Confirmed'] ?? 0} label="Meetings" />
            </div>
          </section>

          {/* ── Needs Action ── */}
          {needsAction.length > 0 && (
            <section className="fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-header" style={{ paddingBottom: 0 }}>Needs Action</div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}
                >
                  {needsAction.length}
                </span>
              </div>
              <div className="space-y-2">
                {needsAction.map(c => (
                  <ContactCard key={c.id} contact={c} onDraft={setDraftContact} />
                ))}
              </div>
            </section>
          )}

          {/* ── Recent Activity ── */}
          {recentActive.length > 0 && (
            <section className="fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-header" style={{ paddingBottom: 0 }}>Recent Activity</div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}
                >
                  {recentActive.length}
                </span>
              </div>
              <div className="space-y-2">
                {recentActive.map(c => (
                  <ContactCard key={c.id} contact={c} onDraft={setDraftContact} />
                ))}
              </div>
            </section>
          )}

          {/* ── All Contacts ── */}
          <section className="fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="section-header" style={{ paddingBottom: 0 }}>All Contacts</div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}
                >
                  {contacts.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {(['last_contact_date', 'status', 'name'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className="px-2.5 py-1 text-xs rounded border transition-colors"
                    style={{
                      borderColor: sortBy === opt ? 'var(--accent)' : 'var(--border)',
                      color: sortBy === opt ? 'var(--accent)' : 'var(--text-dim)',
                      backgroundColor: sortBy === opt ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    {opt === 'last_contact_date' ? 'Date' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sortedContacts.map(c => (
                <ContactCard key={c.id} contact={c} onDraft={setDraftContact} />
              ))}
            </div>
          </section>

        </div>
      )}

      {draftContact && (
        <EmailDraftModal contact={draftContact} onClose={() => setDraftContact(null)} />
      )}
    </AppLayout>
  );
}
