import { google } from 'googleapis';

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

export interface GmailThreadSummary {
  threadId: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  latestDate: Date | null;
  snippet: string;
  hasReply: boolean;
}

export async function verifyGmailAccess(
  gmail: ReturnType<typeof getGmailClient>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await gmail.users.getProfile({ userId: 'me' });
    console.log('[Gmail] Auth OK — inbox address:', res.data.emailAddress);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Gmail] Auth check FAILED:', msg);
    return { ok: false, error: msg };
  }
}

export async function getThreadSummariesForEmail(
  gmail: ReturnType<typeof getGmailClient>,
  contactEmail: string,
  userEmail: string
): Promise<GmailThreadSummary[]> {
  const summaries: GmailThreadSummary[] = [];
  const seenThreadIds = new Set<string>();

  const queries = [
    `to:${contactEmail} newer_than:10m`,
    `from:${contactEmail} newer_than:10m`,
  ];

  for (const q of queries) {
    let listRes;
    try {
      listRes = await gmail.users.threads.list({ userId: 'me', q, maxResults: 10 });
    } catch (err) {
      console.warn('[Gmail] threads.list failed for "' + q + '":', err instanceof Error ? err.message : err);
      continue;
    }

    for (const thread of listRes.data.threads ?? []) {
      if (!thread.id || seenThreadIds.has(thread.id)) continue;
      seenThreadIds.add(thread.id);

      try {
        const threadData = await gmail.users.threads.get({
          userId: 'me',
          id: thread.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        const messages = threadData.data.messages ?? [];
        if (messages.length === 0) continue;

        const firstHeaders = messages[0].payload?.headers ?? [];
        const subject = firstHeaders.find(h => h.name === 'Subject')?.value ?? '(no subject)';
        const fromAddress = firstHeaders.find(h => h.name === 'From')?.value ?? '';
        const toAddress = firstHeaders.find(h => h.name === 'To')?.value ?? '';

        const lastMsg = messages[messages.length - 1];
        const lastHeaders = lastMsg.payload?.headers ?? [];
        const latestDateStr = lastHeaders.find(h => h.name === 'Date')?.value ?? '';
        const latestDate = latestDateStr ? new Date(latestDateStr) : null;
        const snippet = lastMsg.snippet ?? '';

        const hasFromMe = messages.some(m =>
          (m.payload?.headers?.find(h => h.name === 'From')?.value ?? '').includes(userEmail)
        );
        const hasFromContact = messages.some(m =>
          (m.payload?.headers?.find(h => h.name === 'From')?.value ?? '')
            .toLowerCase()
            .includes(contactEmail.toLowerCase())
        );

        summaries.push({
          threadId: thread.id,
          subject,
          fromAddress,
          toAddress,
          latestDate: latestDate && !isNaN(latestDate.getTime()) ? latestDate : null,
          snippet,
          hasReply: hasFromMe && hasFromContact,
        });
      } catch (err) {
        console.warn('[Gmail] threads.get failed for ' + thread.id + ':', err instanceof Error ? err.message : err);
      }
    }
  }

  return summaries;
}
