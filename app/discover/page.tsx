'use client';

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import type { DiscoverSuggestion } from '@/types';

const EXAMPLES = [
  'Investment banking analysts at Citi Dubai',
  'PE associates at KKR London',
  'M&A analysts at Goldman Sachs UAE',
  'Investment banking MDs at HSBC London',
];

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState<number | null>(null);

  const discover = async (q?: string) => {
    const finalQuery = q ?? query;
    if (!finalQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setSuggestions([]);
    setAdded(new Set());

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async (s: DiscoverSuggestion, idx: number) => {
    setAdding(idx);
    const companyMatch = query.match(/at (.+?)(?:\s+in|\s+london|\s+dubai|$)/i);
    const company = companyMatch ? companyMatch[1].trim() : null;

    await fetch('/api/discover', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: s.name, role: s.role, company }),
    });
    setAdded(prev => { const next = new Set(prev); next.add(idx); return next; });
    setAdding(null);
  };

  return (
    <AppLayout>
      <div className="mb-10 fade-up">
        <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
          Discover
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          AI-powered contact discovery for targeted outreach
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3 fade-up" style={{ animationDelay: '0.05s' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && discover()}
          placeholder="e.g. investment banking associates at Citi Dubai"
          className="w-full px-5 py-4 text-base rounded-lg border outline-none pr-32"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-light)',
            color: 'var(--text)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
        />
        <button
          onClick={() => discover()}
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#0C0C0A' }}
        >
          {loading ? '...' : 'Discover'}
        </button>
      </div>

      {/* Examples */}
      {!searched && (
        <div className="flex flex-wrap gap-2 mb-10 fade-up" style={{ animationDelay: '0.1s' }}>
          {EXAMPLES.map(e => (
            <button
              key={e}
              onClick={() => { setQuery(e); discover(e); }}
              className="text-xs px-3 py-1.5 rounded border transition-all"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
              onMouseEnter={ev => {
                (ev.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                (ev.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={ev => {
                (ev.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)';
                (ev.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {searched && (
        <div
          className="mb-6 text-xs p-3 rounded border fade-up"
          style={{
            color: 'var(--text-dim)',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-card)',
            fontSize: '0.65rem',
          }}
        >
          ⚠ These are AI-generated suggestions based on public knowledge. Verify on LinkedIn before reaching out.
        </div>
      )}

      {loading && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>
          Generating suggestions...
        </div>
      )}

      {!loading && searched && suggestions.length === 0 && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>
          No suggestions generated. Try a more specific query.
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="section-header mb-4">Suggested Contacts</div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="contact-card p-5 rounded-lg border fade-up"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                animationDelay: `${0.04 * i}s`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-display text-xl" style={{ color: 'var(--text)' }}>
                    {s.name === 'Not specified' ? (
                      <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Name not specified</span>
                    ) : s.name}
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {s.role}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex gap-2 items-start">
                      <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--text-dim)' }}>Why</span>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.reason}</p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>Angle</span>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{s.outreachAngle}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => addContact(s, i)}
                  disabled={added.has(i) || adding === i}
                  className="shrink-0 px-4 py-2 text-xs rounded border font-medium transition-all"
                  style={{
                    borderColor: added.has(i) ? 'var(--up)' : 'var(--border-light)',
                    color: added.has(i) ? 'var(--up)' : 'var(--text-muted)',
                    backgroundColor: added.has(i) ? 'var(--up-soft)' : 'transparent',
                  }}
                >
                  {added.has(i) ? 'Added' : adding === i ? '...' : 'Add to Contacts'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
