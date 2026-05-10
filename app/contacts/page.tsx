'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import EmailDraftModal from '@/components/ui/EmailDraftModal';
import type { Contact } from '@/types';

const STATUS_OPTIONS = [
  'All Statuses',
  'Needs Response',
  'Awaiting Reply',
  'Gone Cold',
  'Recent Meeting',
  'Meeting Had — Follow Up',
  'Opportunity Active',
  'No Response',
];

const REGION_OPTIONS = ['All Regions', 'Dubai', 'London', 'Other'];
const SORT_OPTIONS = [
  { value: 'last_contact_date', label: 'Last Contact' },
  { value: 'name', label: 'Name' },
  { value: 'company', label: 'Company' },
];

function DetailPanel({ contact, onClose, onSaveNotes }: {
  contact: Contact;
  onClose: () => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [showDraft, setShowDraft] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, notes }),
    });
    onSaveNotes(contact.id, notes);
    setSaving(false);
  };

  return (
    <>
      <div
        className="fixed right-0 top-0 h-screen w-96 border-l overflow-y-auto z-30"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-3xl font-light" style={{ color: 'var(--text)' }}>
                {contact.name}
              </h2>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {contact.company}
                {contact.role && <span style={{ color: 'var(--text-dim)' }}> · {contact.role}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <StatusBadge status={contact.true_status} />
                {contact.region && (
                  <span className="badge badge-unverified">{contact.region}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-xl transition-colors mt-1"
              style={{ color: 'var(--text-dim)' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Contact info */}
          {contact.email && (
            <div>
              <div className="section-header mb-2" style={{ fontSize: '0.62rem' }}>Email</div>
              <a
                href={`mailto:${contact.email}`}
                className="text-sm transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                {contact.email}
              </a>
            </div>
          )}

          {/* Stats */}
          <div>
            <div className="section-header mb-3" style={{ fontSize: '0.62rem' }}>Activity</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Emails Sent', value: contact.emails_sent },
                { label: 'Replies', value: contact.emails_received },
                {
                  label: 'First Contact',
                  value: contact.first_contact_date
                    ? new Date(contact.first_contact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : '—',
                },
                {
                  label: 'Last Contact',
                  value: contact.last_contact_date
                    ? new Date(contact.last_contact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : '—',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="p-3 rounded border"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                >
                  <div
                    className="text-base font-display"
                    style={{ color: 'var(--text)', fontFamily: typeof item.value === 'number' ? 'DM Mono, monospace' : undefined }}
                  >
                    {item.value}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)', fontSize: '0.62rem' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {contact.ai_summary && (
            <div>
              <div className="section-header mb-2" style={{ fontSize: '0.62rem' }}>AI Analysis</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {contact.ai_summary}
              </p>
              {contact.next_action && (
                <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                  → {contact.next_action}
                </p>
              )}
            </div>
          )}

          {/* Thread snippet */}
          {contact.thread_snippet && (
            <div>
              <div className="section-header mb-2" style={{ fontSize: '0.62rem' }}>Latest Thread</div>
              <p
                className="text-xs leading-relaxed p-3 rounded border italic"
                style={{
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '0.65rem',
                }}
              >
                &ldquo;{contact.thread_snippet}&rdquo;
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="section-header mb-2" style={{ fontSize: '0.62rem' }}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Add private notes..."
              className="w-full px-3 py-2 text-sm rounded border outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-light)',
                color: 'var(--text)',
                lineHeight: 1.6,
              }}
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 w-full py-2 text-xs rounded border transition-all"
              style={{
                borderColor: 'var(--border-light)',
                color: saving ? 'var(--text-dim)' : 'var(--text-muted)',
              }}
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Draft email */}
          <button
            onClick={() => setShowDraft(true)}
            className="w-full py-2.5 text-sm rounded border font-medium transition-all"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
              backgroundColor: 'var(--accent-soft)',
            }}
          >
            Draft Follow-Up Email
          </button>
        </div>
      </div>

      {showDraft && (
        <EmailDraftModal contact={contact} onClose={() => setShowDraft(false)} />
      )}
    </>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Statuses');
  const [region, setRegion] = useState('All Regions');
  const [sort, setSort] = useState('last_contact_date');
  const [selected, setSelected] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'All Statuses') params.set('status', status);
    if (region !== 'All Regions') params.set('region', region);
    params.set('sort', sort);

    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  }, [search, status, region, sort]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleSaveNotes = (id: string, notes: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, notes } : null);
  };

  const selectStyle = {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-light)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    outline: 'none',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid',
  };

  return (
    <AppLayout>
      <div className="mb-8 fade-up">
        <h1 className="font-display text-4xl font-light" style={{ color: 'var(--text)' }}>
          All Contacts
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {contacts.length} contacts
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap fade-up" style={{ animationDelay: '0.05s' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or company..."
          className="flex-1 min-w-48 px-3 py-1.5 text-sm rounded border outline-none"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-light)',
            color: 'var(--text)',
          }}
        />
        <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={region} onChange={e => setRegion(e.target.value)} style={selectStyle}>
          {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
          {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>No contacts found.</div>
      ) : (
        <div className="space-y-2 mr-0 transition-all" style={{ marginRight: selected ? '384px' : '0' }}>
          {/* Header row */}
          <div
            className="grid gap-4 px-4 py-2 text-xs"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 120px 80px',
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: '0.6rem',
            }}
          >
            <span>Name</span>
            <span>Company</span>
            <span>Region</span>
            <span>Status</span>
            <span>Last Contact</span>
            <span>Emails</span>
          </div>

          {contacts.map((c, i) => (
            <div
              key={c.id}
              className="contact-card grid gap-4 px-4 py-3 rounded border fade-up"
              style={{
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 120px 80px',
                backgroundColor: selected?.id === c.id ? 'var(--bg-elevated)' : 'var(--bg-card)',
                borderColor: selected?.id === c.id ? 'var(--accent)' : 'var(--border)',
                borderLeft: selected?.id === c.id ? '2px solid var(--accent)' : '2px solid transparent',
                animationDelay: `${0.03 * i}s`,
                alignItems: 'center',
              }}
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              <span className="font-display text-lg truncate" style={{ color: 'var(--text)' }}>{c.name}</span>
              <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{c.company ?? '—'}</span>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.region ?? '—'}</span>
              <StatusBadge status={c.true_status} />
              <span
                className="text-xs"
                style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
              >
                {c.last_contact_date
                  ? new Date(c.last_contact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  : '—'}
              </span>
              <span
                className="text-xs"
                style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
              >
                {c.emails_sent}↑ {c.emails_received}↓
              </span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <DetailPanel
          contact={selected}
          onClose={() => setSelected(null)}
          onSaveNotes={handleSaveNotes}
        />
      )}
    </AppLayout>
  );
}
