import { google } from 'googleapis';

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

export async function verifyGmailAccess(
  gmail: ReturnType<typeof getGmailClient>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await gmail.users.getProfile({ userId: 'me' });
    console.log('[Gmail] Auth OK:', res.data.emailAddress);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Gmail] Auth FAILED:', msg);
    return { ok: false, error: msg };
  }
}

// ── Types ────────────────────────────────────────────────────────────────

export interface GmailContact {
  name: string;
  email: string;
  company: string | null;
  firstContacted: string;
  lastContact: string;
  emailsSent: number;
  repliesReceived: number;
  meetingHappened: boolean;
  latestSnippet: string;
  status: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const ALI_EMAIL = 'chaudhry.ali044@gmail.com';

const MEETING_SIGNALS = [
  'zoom.us', 'meet.google.com', 'teams.microsoft.com',
  'calendar.google.com', 'calendly.com', '.ics',
  'calendar invite', 'video call', 'phone call',
];

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'me.com', 'live.com', 'msn.com',
]);

const QUERIES = [
  'from:me ("Brief Introduction" OR "Thank you for inspiring" OR "LSE" OR "networking") newer_than:10m',
  'to:me newer_than:10m -category:promotions -category:social -category:updates',
  '("coffee" OR "call" OR "zoom" OR "teams" OR "schedule" OR "interview") newer_than:10m -category:promotions',
];

function parseAddress(raw: string): { name: string; email: string } | null {
  if (!raw || !raw.trim()) return null;
  const match = raw.match(/^"?(.+?)"?\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].toLowerCase().trim() };
  }
  const emailOnly = raw.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/);
  if (emailOnly) {
    return { name: raw.split('@')[0], email: raw.toLowerCase().trim() };
  }
  return null;
}

function domainToCompany(email: string): string | null {
  const domain = email.split('@')[1];
  if (!domain) return null;
  if (PERSONAL_DOMAINS.has(domain.toLowerCase())) return null;
  const parts = domain.split('.');
  const name = parts[parts.length - 2] ?? parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function hasMeetingSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return MEETING_SIGNALS.some(s => lower.includes(s));
}

function computeStatus(
  emailsSent: number,
  repliesReceived: number,
  meetingHappened: boolean,
  lastDate: Date,
  lastAliDate: Date | null,
  lastContactReplyDate: Date | null,
  now: Date,
): string {
  if (meetingHappened) return 'Meeting Confirmed';

  const daysSinceLast = (now.getTime() - lastDate.getTime()) / 86_400_000;

  if (daysSinceLast <= 7) return 'Active';
  if (repliesReceived > 0 && daysSinceLast > 30) return 'Gone Cold';

  // Contact replied, Ali hasn't followed up in 14+ days
  if (repliesReceived > 0 && lastContactReplyDate) {
    const aliRespondedAfter = lastAliDate && lastAliDate > lastContactReplyDate;
    if (!aliRespondedAfter && daysSinceLast > 14) return 'Replied — Follow Up Needed';
  }

  if (emailsSent > 0 && repliesReceived === 0) return 'No Response';
  if (daysSinceLast >= 7 && daysSinceLast <= 14) return 'Awaiting Reply';

  return 'Awaiting Reply';
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function buildContactsFromGmail(
  gmail: ReturnType<typeof getGmailClient>,
  onProgress?: (msg: string) => void,
): Promise<GmailContact[]> {
  const log = (msg: string) => { console.log('[Gmail]', msg); onProgress?.(msg); };

  // Step 1: collect unique thread IDs from all three queries
  const threadIds = new Set<string>();
  for (const q of QUERIES) {
    try {
      const res = await gmail.users.threads.list({ userId: 'me', q, maxResults: 100 });
      for (const t of res.data.threads ?? []) {
        if (t.id) threadIds.add(t.id);
      }
      log(`Query done: ${threadIds.size} threads so far`);
    } catch (err) {
      console.warn('[Gmail] Query failed:', q, err instanceof Error ? err.message : err);
    }
  }
  log(`Total unique threads: ${threadIds.size}`);

  // Step 2: fetch each thread and build contact map
  type ContactAccum = {
    name: string;
    email: string;
    company: string | null;
    firstDate: Date | null;
    lastDate: Date | null;
    lastAliDate: Date | null;
    lastContactReplyDate: Date | null;
    emailsSent: number;
    repliesReceived: number;
    meetingHappened: boolean;
    latestSnippet: string;
  };

  const contactMap = new Map<string, ContactAccum>();

  let processed = 0;
  for (const threadId of threadIds) {
    processed++;
    if (processed % 20 === 0) log(`Processing thread ${processed}/${threadIds.size}...`);

    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Date', 'Subject'],
      });

      const messages = thread.data.messages ?? [];
      if (messages.length === 0) continue;

      // Identify the contact email (first non-Ali address in the thread)
      let contactEmail: string | null = null;
      let contactName = '';

      for (const msg of messages) {
        const headers = msg.payload?.headers ?? [];
        const from = headers.find(h => h.name === 'From')?.value ?? '';
        const to = headers.find(h => h.name === 'To')?.value ?? '';
        const fromLower = from.toLowerCase();

        if (fromLower.includes(ALI_EMAIL)) {
          // Ali sent this — contact is in To
          for (const part of to.split(',')) {
            const parsed = parseAddress(part.trim());
            if (parsed && !parsed.email.includes(ALI_EMAIL)) {
              contactEmail = parsed.email;
              contactName = parsed.name;
              break;
            }
          }
        } else {
          const parsed = parseAddress(from);
          if (parsed && !parsed.email.includes(ALI_EMAIL)) {
            contactEmail = parsed.email;
            contactName = parsed.name || parsed.email.split('@')[0];
          }
        }
        if (contactEmail) break;
      }

      if (!contactEmail || contactEmail === ALI_EMAIL) continue;

      let c = contactMap.get(contactEmail);
      if (!c) {
        c = {
          name: contactName,
          email: contactEmail,
          company: domainToCompany(contactEmail),
          firstDate: null,
          lastDate: null,
          lastAliDate: null,
          lastContactReplyDate: null,
          emailsSent: 0,
          repliesReceived: 0,
          meetingHappened: false,
          latestSnippet: '',
        };
        contactMap.set(contactEmail, c);
      }

      // Aggregate per message
      for (const msg of messages) {
        const headers = msg.payload?.headers ?? [];
        const from = headers.find(h => h.name === 'From')?.value ?? '';
        const dateStr = headers.find(h => h.name === 'Date')?.value ?? '';
        const snippet = msg.snippet ?? '';
        const date = dateStr ? new Date(dateStr) : null;

        if (date && !isNaN(date.getTime())) {
          if (!c.firstDate || date < c.firstDate) c.firstDate = date;
          if (!c.lastDate || date > c.lastDate) {
            c.lastDate = date;
            c.latestSnippet = snippet;
          }
        }

        if (hasMeetingSignal(snippet)) c.meetingHappened = true;

        const fromLower = from.toLowerCase();
        if (fromLower.includes(ALI_EMAIL)) {
          c.emailsSent++;
          if (date && !isNaN(date.getTime())) {
            if (!c.lastAliDate || date > c.lastAliDate) c.lastAliDate = date;
          }
        } else if (fromLower.includes(contactEmail.toLowerCase())) {
          c.repliesReceived++;
          if (date && !isNaN(date.getTime())) {
            if (!c.lastContactReplyDate || date > c.lastContactReplyDate) c.lastContactReplyDate = date;
          }
        }
      }
    } catch (err) {
      console.warn('[Gmail] Thread fetch failed:', threadId, err instanceof Error ? err.message : err);
    }
  }

  log(`Built ${contactMap.size} contacts from threads`);

  // Step 3: compute status and build final list
  const now = new Date();
  const result: GmailContact[] = [];

  for (const [, c] of contactMap) {
    if (!c.firstDate) continue;

    const status = computeStatus(
      c.emailsSent,
      c.repliesReceived,
      c.meetingHappened,
      c.lastDate ?? now,
      c.lastAliDate,
      c.lastContactReplyDate,
      now,
    );

    result.push({
      name: c.name,
      email: c.email,
      company: c.company,
      firstContacted: c.firstDate.toISOString().split('T')[0],
      lastContact: (c.lastDate ?? c.firstDate).toISOString().split('T')[0],
      emailsSent: c.emailsSent,
      repliesReceived: c.repliesReceived,
      meetingHappened: c.meetingHappened,
      latestSnippet: c.latestSnippet,
      status,
    });
  }

  return result.sort((a, b) =>
    new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
  );
}
