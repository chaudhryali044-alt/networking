import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAnalysis, EmailDraft, DiscoverSuggestion } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function analyzeThread(
  contactName: string,
  company: string,
  threadSnippets: string[]
): Promise<AIAnalysis | null> {
  try {
    const prompt = `Summarise this networking thread in one sentence. What is the current status and what should the next action be?

Contact: ${contactName} at ${company}
Thread snippets:
${threadSnippets.join('\n---\n')}

Return ONLY valid JSON with this exact structure:
{"summary": "one sentence summary", "nextAction": "specific next action", "urgency": "high|medium|low"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as AIAnalysis;
  } catch {
    return null;
  }
}

export async function draftEmail(
  contactName: string,
  company: string,
  threadSnippets: string[],
  aiSummary: string
): Promise<EmailDraft | null> {
  try {
    const prompt = `You are helping Ali Chaudhry, an LSE MSc graduate from Pakistan targeting investment banking and PE roles in the UAE and London. Draft a brief, professional follow-up email to ${contactName} at ${company}.

Context from previous emails: ${threadSnippets.join('\n---\n')}
Current situation: ${aiSummary}

The email should:
- Be 3-4 sentences maximum
- Reference something specific from previous conversation
- Have a clear, single ask
- Sound like Ali wrote it — warm but professional
- Never be generic or sycophantic

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

export async function naturalLanguageSearch(
  query: string
): Promise<{ filter: string; explanation: string } | null> {
  try {
    const prompt = `Convert this natural language search query about networking contacts into a structured filter description.

Query: "${query}"

Possible fields: name, company, role, region (Dubai/London/Other), true_status, meeting_happened, urgency, ai_summary

Return ONLY valid JSON: {"filter": "SQL-like description of filter", "explanation": "plain English explanation of what we'll search for"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export async function discoverContacts(
  firmOrRole: string
): Promise<DiscoverSuggestion[]> {
  try {
    const prompt = `You are helping Ali Chaudhry (LSE MSc Finance graduate from Pakistan) find relevant people to cold outreach for investment banking and PE networking in the UAE and London.

Request: "${firmOrRole}"

Based on Ali's background (LSE MSc, Pakistani origin, targeting IB/PE in UAE and London), generate 5-8 suggested outreach targets.

Return ONLY valid JSON array:
[{"name": "Name or 'Not specified'", "role": "role title", "reason": "why they'd be a good contact for Ali", "outreachAngle": "specific angle for cold email"}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as DiscoverSuggestion[];
  } catch {
    return [];
  }
}
