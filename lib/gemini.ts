import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmailDraft, DiscoverSuggestion } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function draftEmail(
  contactName: string,
  company: string,
  threadSnippets: string[],
): Promise<EmailDraft | null> {
  try {
    const snippetText = threadSnippets.filter(Boolean).join('\n---\n');
    const prompt = `Draft a brief professional follow up email from Ali Chaudhry (LSE MSc Finance graduate from Pakistan, targeting investment banking and private equity roles in UAE and London) to ${contactName}${company ? ' at ' + company : ''}.

Previous conversation:
${snippetText || '(No previous conversation recorded)'}

Requirements:
- 3-4 sentences maximum
- Reference something specific from the conversation if available
- Single clear ask (meeting, call, intro, etc.)
- Professional but warm — not generic or sycophantic
- Sign off as Ali

Return ONLY valid JSON: {"subject": "string", "body": "string"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as EmailDraft;
  } catch {
    return null;
  }
}

export async function discoverContacts(
  firmOrRole: string,
): Promise<DiscoverSuggestion[]> {
  try {
    const prompt = `You are helping Ali Chaudhry (LSE MSc Finance graduate from Pakistan) find relevant people to cold outreach for investment banking and PE networking in the UAE and London.

Request: "${firmOrRole}"

Generate 5-8 suggested outreach targets based on Ali's background.

Return ONLY valid JSON array:
[{"name": "Name or 'Not specified'", "role": "role title", "reason": "why relevant for Ali", "outreachAngle": "specific angle for cold email"}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as DiscoverSuggestion[];
  } catch {
    return [];
  }
}

export async function naturalLanguageSearch(
  query: string,
): Promise<{ filter: string; explanation: string } | null> {
  try {
    const prompt = `Convert this natural language search query about networking contacts into a structured filter description.

Query: "${query}"

Possible fields: name, company, email, true_status, meeting_happened, emails_sent, emails_received

Return ONLY valid JSON: {"filter": "SQL-like description", "explanation": "plain English explanation"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
