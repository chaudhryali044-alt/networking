'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Contact, GmailThread } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function extractName(address: string): string {
  const match = address.match(/^(.+?)\s*</);
  return match ? match[1].replace(/"/g, '').trim() : address.split('@')[0];
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="section-header" style={{ paddingBottom: 0 }}>{title}</div>
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}
      >
        {count}
      </span>
    </div>
  );
}

function SheetContactRow({ contact }: { contact: Contact }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <span className="font-display text-lg" style={{ color: 'var(--text)' }}>{contact.name}</span>
          {contact.company && (
            <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>{contact.company}</span>
          )}
          {contact.role && (
            <span className="text-xs ml-1" style={{ color: 'var(--text-dim)' }}> · {contact.role}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {contact.email && (
          <span className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>
            {contact.email}
          </span>
        )}
        {contact.spreadsheet_status && <StatusBadge status={contact.spreadsheet_status} />}
        {contact.region && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '0.08em' }}
          >
            {contact.region}
          </span>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: GmailThread }) {
  const name = thread.contact_name ?? extractName(thread.from_address ?? thread.to_address ?? '');
  return (
    <div
      className="px-4 py-3 rounded-lg border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-base" style={{ color: 'var(--text)' }}>{name}</span>
            {thread.has_reply && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(180,155,100,0.12)', color: 'var(--accent)', fontSize: '0.6rem', letterSpacing: '0.08em' }}
              >
                REPLIED
              </span>
            )}
          </div>
          <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {thread.subject}
          </div>
          {thread.snippet && (
            <div
              className="text-xs mt-1 line-clamp-2"
              style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}
            >
              {thread.snippet}
            </div>
          )}
          <div className="text-xs mt-1.5" style={{ color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem' }}>
            {thread.from_address}
          </div>
        </div>
        {thread.latest_date && (
          <span
            className="text-xs shrink-0 mt-0.5"
            style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
          >
            {fmtDate(thread.latest_date)}
          </span>
        )}
      </div>
    </div>
  );
}

function MatchedRow({ contact, threads }: { contact: Contact; threads: GmailThread[] }) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', borderTop: '2px solid var(--accent)' }}
      >
        <div>
          <span className="font-display text-xl" style={{ color: 'var(--text)' }}>{contact.name}</span>
          {contact.company && (
            <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>{contact.company}</span>
          )}
          {contact.role && (
            <span className="text-sm ml-1" style={{ color: 'var(--text-dim)' }}> · {contact.role}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {contact.spreadsheet_status && <StatusBadge status={contact.spreadsheet_status} />}
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}
          >
            {threads.length} thread{threads.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {threads.map(t => (
          <div key={t.thread_id} className="px-4 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.subject}</span>
                  {t.has_reply && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(180,155,100,0.12)', color: 'var(--accent)', fontSize: '0.58rem', letterSpacing: '0.08em' }}
                    >
                      REPLIED
                    </span>
                  )}
                </div>
                {t.snippet && (
                  <div className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    {t.snippet}
                  </div>
                )}
              </div>
              {t.latest_date && (
                <span className="text-xs shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}>
                  {fmtDate(t.latest_date)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sync progress overlay ──────────────────────────────────────────────────

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
      {!error && (
        <span className="text-xs animate-pulse" style={{ color: 'var(--accent)' }}>◉</span>
      )}
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
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncSummary, setSyncSummary] = useState('');
  const didAutoSync = useRef(false);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [cRes, tRes] = await Promise.all([
      fetch('/api/contacts').then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch('/api/gmail-threads').then(r => r.json()).catch(() => ({ threads: [] })),
    ]);
    setContacts(cRes.contacts ?? []);
    setThreads(tRes.threads ?? []);
    setLoadingData(false);
  }, []);

  const runSync = useCallback(async (force = false) => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Starting sync…');
    setSyncError('');
    setSyncSummary('');

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
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
        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
        for (const line of lines) {
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
      await loadData();
      setSyncStatus('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setSyncStatus('');
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadData]);

  // Load data on mount
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-sync once per session, guarded by 24h localStorage flag
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session || didAutoSync.current) return;
    didAutoSync.current = true;

    const stored = localStorage.getItem('orbitLastSync');
    if (stored) {
      const hoursSince = (Date.now() - new Date(stored).getTime()) / 3_600_000;
      if (hoursSince < 24) {
        console.log('[Dashboard] Skipping auto-sync — synced', Math.round(hoursSince), 'h ago');
        return;
      }
    }
    runSync(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // ── Derived data ───────────────────────────────────────────────────────
  const matchedContacts = contacts.filter(c =>
    c.email && threads.some(t => t.contact_email?.toLowerCase() === c.email?.toLowerCase())
  );
  const matchedEmails = new Set(matchedContacts.map(c => c.email?.toLowerCase()));

  const unmatchedThreads = threads.filter(t =>
    !t.contact_email || !matchedEmails.has(t.contact_email.toLowerCase())
  );

  const sheetOnlyContacts = contacts.filter(c =>
    !c.email || !matchedEmails.has(c.email.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 fade-up" style={{ animationDelay: '0s' }}>
        <div>
          <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Your networking intelligence overview
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 mt-1">
          <button
            onClick={() => runSync(true)}
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
              ✓ Sync complete — {syncSummary}
            </div>
          )}
        </div>
      </div>

      {/* Sync status banner */}
      {(syncing || syncError) && (
        <SyncBanner status={syncing ? syncStatus : ''} error={syncError} />
      )}

      {loadingData && !syncing ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        </div>
      ) : (
        <div className="space-y-12">

          {/* ── Section 1: From Your Spreadsheet ── */}
          <section className="fade-up" style={{ animationDelay: '0.05s' }}>
            <SectionHeader title="From Your Spreadsheet" count={contacts.length} />
            {contacts.length === 0 ? (
              <div
                className="text-center py-10 rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {syncing ? 'Reading spreadsheet…' : 'No contacts yet — click Sync Now to load your sheet'}
              </div>
            ) : (
              <div className="space-y-2">
                {sheetOnlyContacts.slice(0, 20).map(c => (
                  <SheetContactRow key={c.id} contact={c} />
                ))}
                {matchedContacts.slice(0, 20).map(c => (
                  <SheetContactRow key={c.id} contact={c} />
                ))}
                {contacts.length > 40 && (
                  <div className="text-xs text-center pt-2" style={{ color: 'var(--text-dim)' }}>
                    + {contacts.length - 40} more — use All Contacts to see full list
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section 2: Gmail Threads ── */}
          <section className="fade-up" style={{ animationDelay: '0.1s' }}>
            <SectionHeader title="Gmail Threads" count={threads.length} />
            {threads.length === 0 ? (
              <div
                className="text-center py-10 rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {syncing ? 'Scanning Gmail…' : 'No Gmail threads found — contacts need an email address in the sheet'}
              </div>
            ) : (
              <div className="space-y-2">
                {unmatchedThreads.length > 0 && (
                  <>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                      UNMATCHED (no exact email in sheet)
                    </div>
                    {unmatchedThreads.slice(0, 10).map(t => (
                      <ThreadRow key={t.thread_id} thread={t} />
                    ))}
                  </>
                )}
                {threads.filter(t => matchedEmails.has(t.contact_email?.toLowerCase() ?? '')).length > 0 && (
                  <>
                    <div className="text-xs mt-4 mb-2" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                      MATCHED TO SHEET CONTACT
                    </div>
                    {threads
                      .filter(t => matchedEmails.has(t.contact_email?.toLowerCase() ?? ''))
                      .slice(0, 20)
                      .map(t => (
                        <ThreadRow key={t.thread_id} thread={t} />
                      ))}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Section 3: Matched Contacts ── */}
          {matchedContacts.length > 0 && (
            <section className="fade-up" style={{ animationDelay: '0.15s' }}>
              <SectionHeader title="Matched Contacts" count={matchedContacts.length} />
              <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
                Sheet contacts with exact email match to Gmail threads
              </p>
              <div className="space-y-3">
                {matchedContacts.slice(0, 15).map(c => {
                  const contactThreads = threads.filter(
                    t => t.contact_email?.toLowerCase() === c.email?.toLowerCase()
                  );
                  return <MatchedRow key={c.id} contact={c} threads={contactThreads} />;
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!syncing && contacts.length === 0 && threads.length === 0 && (
            <div
              className="text-center py-16 rounded-lg border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
            >
              <div className="font-display text-2xl mb-2" style={{ color: 'var(--text)' }}>No data yet</div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Click &ldquo;Sync Now&rdquo; to read your Google Sheet and Gmail.
              </p>
              <button
                onClick={() => runSync(true)}
                className="px-6 py-2.5 text-sm rounded font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#0C0C0A' }}
              >
                Sync Now
              </button>
            </div>
          )}

        </div>
      )}
    </AppLayout>
  );
}
