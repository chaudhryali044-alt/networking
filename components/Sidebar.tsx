'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/contacts', label: 'All Contacts', icon: '◎' },
  { href: '/action', label: 'Needs Action', icon: '◉' },
  { href: '/search', label: 'Search', icon: '◐' },
  { href: '/discover', label: 'Discover', icon: '◇' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string>('');

  useEffect(() => {
    fetch('/api/sync')
      .then(r => r.json())
      .then(d => {
        const lastSyncTime = d.lastSync?.synced_at ?? null;
        if (lastSyncTime) {
          setLastSynced(lastSyncTime);
          // Auto-sync if last sync was more than 6 hours ago
          const hoursSince = (Date.now() - new Date(lastSyncTime).getTime()) / 3_600_000;
          if (hoursSince > 6) {
            handleSync();
          }
        } else {
          // Never synced — trigger automatically on first load
          handleSync();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncStep('Starting sync...');
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            setSyncStep(parsed.detail ? `${parsed.step} ${parsed.detail}` : parsed.step);
          } catch {}
        }
      }
      setLastSynced(new Date().toISOString());
    } catch {
      setSyncStep('Sync failed');
    } finally {
      setSyncing(false);
      setSyncStep('');
    }
  };

  const formatSynced = (ts: string) => {
    const d = new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col border-r z-40"
      style={{
        width: '220px',
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-8 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <span
          className="font-display text-3xl italic"
          style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}
        >
          Orbit
        </span>
        <div className="text-xs mt-1" style={{ color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Networking Intelligence
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all group"
              style={{
                backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <span
                className="text-xs w-4 text-center transition-colors"
                style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}
              >
                {active ? '●' : item.icon}
              </span>
              {item.label}
              {active && (
                <span
                  className="ml-auto w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 pb-6 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        {syncing && syncStep && (
          <div
            className="text-xs px-2 py-1.5 rounded leading-tight"
            style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)', fontSize: '0.6rem' }}
          >
            {syncStep}
          </div>
        )}

        {lastSynced && !syncing && (
          <div className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
            Synced {formatSynced(lastSynced)}
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full py-2 text-xs rounded border transition-all font-medium"
          style={{
            borderColor: syncing ? 'var(--border)' : 'var(--accent)',
            color: syncing ? 'var(--text-dim)' : 'var(--accent)',
            backgroundColor: syncing ? 'transparent' : 'var(--accent-soft)',
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>

        <button
          onClick={() => signOut()}
          className="w-full py-1.5 text-xs rounded transition-colors"
          style={{ color: 'var(--text-dim)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
