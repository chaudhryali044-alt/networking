'use client';

import { useState } from 'react';
import type { Contact } from '@/types';
import StatusBadge from './StatusBadge';
import EmailDraftModal from './EmailDraftModal';

interface Props {
  contact: Contact;
  delay?: number;
  onClick?: () => void;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ContactCard({ contact, delay = 0, onClick }: Props) {
  const [showDraft, setShowDraft] = useState(false);
  const days = daysSince(contact.last_contact_date);

  return (
    <>
      <div
        className="contact-card p-4 rounded-lg border fade-up"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border)',
          animationDelay: `${delay}s`,
        }}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-display text-xl leading-tight truncate"
                style={{ color: 'var(--text)' }}
              >
                {contact.name}
              </h3>
              <StatusBadge status={contact.true_status} />
            </div>

            {contact.company && (
              <div className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {contact.company}
                {contact.role && (
                  <span style={{ color: 'var(--text-dim)' }}> · {contact.role}</span>
                )}
              </div>
            )}

            {contact.ai_summary && (
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {contact.ai_summary}
              </p>
            )}

            {contact.next_action && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--accent)' }}>
                → {contact.next_action}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {days !== null && (
              <span
                className="text-xs tabular-nums"
                style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}
              >
                {days}d ago
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDraft(true); }}
              className="text-xs px-3 py-1.5 rounded border transition-all"
              style={{
                borderColor: 'var(--border-light)',
                color: 'var(--text-muted)',
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
              Draft Email
            </button>
          </div>
        </div>
      </div>

      {showDraft && (
        <EmailDraftModal contact={contact} onClose={() => setShowDraft(false)} />
      )}
    </>
  );
}
