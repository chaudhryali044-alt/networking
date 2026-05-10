import { google } from 'googleapis';

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

export interface ThreadInfo {
  email: string;
  firstContactDate: Date | null;
  lastContactDate: Date | null;
  emailsSent: number;
  emailsReceived: number;
  meetingHappened: boolean;
  meetingDate: Date | null;
  snippets: string[];
}

function hasMeetingSignal(text: string): boolean {
  const signals = ['zoom.us', 'teams.microsoft.com', 'meet.google.com', 'calendar.google.com', 'calendly.com', 'interview', 'coffee chat', 'call scheduled', 'meeting scheduled'];
  const lower = text.toLowerCase();
  return signals.some(s => lower.includes(s));
}

export async function getThreadsForEmail(
  gmail: ReturnType<typeof getGmailClient>,
  contactEmail: string,
  userEmail: string
): Promise<ThreadInfo> {
  const result: ThreadInfo = {
    email: contactEmail,
    firstContactDate: null,
    lastContactDate: null,
    emailsSent: 0,
    emailsReceived: 0,
    meetingHappened: false,
    meetingDate: null,
    snippets: [],
  };

  try {
    const queries = [
      `to:${contactEmail} newer_than:10m`,
      `from:${contactEmail} newer_than:10m`,
    ];

    const messageIds = new Set<string>();

    for (const q of queries) {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults: 20,
      });
      for (const msg of res.data.messages ?? []) {
        if (msg.id) messageIds.add(msg.id);
      }
    }

    for (const id of messageIds) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Date', 'Subject'],
      });

      const headers = msg.data.payload?.headers ?? [];
      const from = headers.find(h => h.name === 'From')?.value ?? '';
      const dateStr = headers.find(h => h.name === 'Date')?.value ?? '';
      const snippet = msg.data.snippet ?? '';

      const date = dateStr ? new Date(dateStr) : null;
      if (date && !isNaN(date.getTime())) {
        if (!result.firstContactDate || date < result.firstContactDate) result.firstContactDate = date;
        if (!result.lastContactDate || date > result.lastContactDate) result.lastContactDate = date;
      }

      const isFromMe = from.includes(userEmail);
      if (isFromMe) {
        result.emailsSent++;
      } else {
        result.emailsReceived++;
      }

      if (snippet && result.snippets.length < 5) {
        result.snippets.push(snippet);
      }

      if (hasMeetingSignal(snippet)) {
        result.meetingHappened = true;
        if (date) result.meetingDate = date;
      }
    }
  } catch {
    // Return empty result on error
  }

  return result;
}

export async function searchOutreachEmails(
  gmail: ReturnType<typeof getGmailClient>
): Promise<{ count: number }> {
  try {
    const queries = [
      'from:me ("Brief Introduction" OR "Thank you for inspiring") newer_than:10m',
      'subject:(interview OR coffee OR call OR schedule) newer_than:10m',
    ];
    let count = 0;
    for (const q of queries) {
      const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 });
      count += (res.data.messages ?? []).length;
    }
    return { count };
  } catch {
    return { count: 0 };
  }
}

export function computeTrueStatus(
  info: ThreadInfo,
  spreadsheetStatus: string | null
): string {
  const now = new Date();
  const daysSinceLastContact = info.lastContactDate
    ? Math.floor((now.getTime() - info.lastContactDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (info.meetingHappened && info.meetingDate) {
    const daysSinceMeeting = Math.floor((now.getTime() - info.meetingDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceMeeting <= 30) return 'Recent Meeting';
    return 'Meeting Had — Follow Up';
  }

  if (!info.firstContactDate) {
    return spreadsheetStatus ?? 'Unverified';
  }

  const lastWasFromThem = info.emailsReceived > 0 &&
    info.lastContactDate &&
    info.emailsSent > 0;

  if (lastWasFromThem && daysSinceLastContact !== null && daysSinceLastContact > 14) {
    return 'Needs Response';
  }

  if (info.emailsSent > 0 && info.emailsReceived === 0) {
    if (daysSinceLastContact !== null && daysSinceLastContact >= 30) return 'Gone Cold';
    if (daysSinceLastContact !== null && daysSinceLastContact >= 14) return 'Awaiting Reply';
    return 'No Response';
  }

  if (info.emailsSent > 0 && info.emailsReceived > 0) {
    if (daysSinceLastContact !== null && daysSinceLastContact >= 30) return 'Gone Cold';
    return 'Awaiting Reply';
  }

  return spreadsheetStatus ?? 'Unverified';
}
