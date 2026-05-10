'use client';

import { useState } from 'react';
import type { Contact, EmailDraft } from '@/types';

interface Props {
  contact: Contact;
  onClose: () => void;
}

export default function EmailDraftModal({ contact, onClose }: Props) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      setSubject(data.draft.subject);
      setBody(data.draft.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate draft');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInGmail = () => {
    const to = contact.email ?? '';
    const url = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(12,12,10,0.85)' }}>
      <div className="w-full max-w-xl rounded-lg border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-light)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="section-header">Draft Email</div>
            <div className="font-display text-xl mt-1" style={{ color: 'var(--text)' }}>
              {contact.name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {contact.company}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-sm transition-colors hover:text-white"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!draft && !loading && (
            <div className="text-center py-8">
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Generate an AI-drafted follow-up email based on your conversation history.
              </p>
              <button
                onClick={generate}
                className="px-6 py-2.5 rounded text-sm font-medium transition-colors"
                style={{ backgroundColor: 'var(--accent)', color: '#0C0C0A' }}
              >
                Generate Draft
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Drafting email...
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm p-3 rounded" style={{ color: 'var(--down)', backgroundColor: 'rgba(139,38,53,0.1)', border: '1px solid var(--down)' }}>
              {error}
            </div>
          )}

          {draft && (
            <div className="space-y-3">
              <div>
                <label className="section-header text-xs block mb-2">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded border outline-none"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="section-header text-xs block mb-2">Body</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm rounded border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)', color: 'var(--text)', lineHeight: '1.6' }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={copy}
                  className="flex-1 py-2 text-sm rounded border transition-colors"
                  style={{ borderColor: 'var(--border-light)', color: copied ? 'var(--up)' : 'var(--text-muted)' }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={openInGmail}
                  className="flex-1 py-2 text-sm rounded border transition-colors"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  Open in Gmail
                </button>
                <button
                  onClick={generate}
                  className="flex-1 py-2 text-sm rounded transition-colors"
                  style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
