'use client';

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import EmailDraftModal from '@/components/ui/EmailDraftModal';
import type { Contact } from '@/types';

const EXAMPLE_QUERIES = [
  'Who do I know at Citi?',
  'Who replied but I haven\'t followed up?',
  'Who did I have a coffee with?',
  'Show me everyone at Goldman Sachs',
  'Contacts in Dubai',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);

  const search = async (q?: string) => {
    const finalQuery = q ?? query;
    if (!finalQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery }),
      });
      const data = await res.json();
      setResults(data.contacts ?? []);
      setExplanation(data.explanation ?? '');
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-10 fade-up">
        <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
          Search
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Natural language search across your contacts
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-3 fade-up" style={{ animationDelay: '0.05s' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Who do I know at Citi? / Who hasn't replied?"
          className="w-full px-5 py-4 text-base rounded-lg border outline-none pr-32"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-light)',
            color: 'var(--text)',
            fontSize: '0.95rem',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
        />
        <button
          onClick={() => search()}
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#0C0C0A',
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {/* Example queries */}
      {!searched && (
        <div className="flex flex-wrap gap-2 mb-10 fade-up" style={{ animationDelay: '0.1s' }}>
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => { setQuery(q); search(q); }}
              className="text-xs px-3 py-1.5 rounded border transition-all"
              style={{
                borderColor: 'var(--border-light)',
                color: 'var(--text-muted)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="mb-6 text-sm" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {explanation}
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>Searching...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>
          No contacts found for that query.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((c, i) => (
            <div
              key={c.id}
              className="contact-card p-4 rounded-lg border fade-up"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                animationDelay: `${0.03 * i}s`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-xl" style={{ color: 'var(--text)' }}>{c.name}</span>
                    <StatusBadge status={c.true_status} />
                    {c.region && <span className="badge badge-unverified">{c.region}</span>}
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
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {c.last_contact_date && (
                    <span
                      className="text-xs"
                      style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
                    >
                      {new Date(c.last_contact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <button
                    onClick={() => setDraftContact(c)}
                    className="text-xs px-3 py-1.5 rounded border transition-all"
                    style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                    }}
                  >
                    Draft Email
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draftContact && (
        <EmailDraftModal contact={draftContact} onClose={() => setDraftContact(null)} />
      )}
    </AppLayout>
  );
}
