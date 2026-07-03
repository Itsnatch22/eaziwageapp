// Server-side only — the Cohere key never reaches the client. Called by
// /api/console routes, never directly from a client component.

const SYSTEM_PROMPT = `You are the summarization layer for EaziWage's internal founder-only incident-response console ("/console"). Your ONLY job is to summarize the pre-aggregated operational data you are given — you have no other access to EaziWage's systems.

Rules:
- Only describe what is present in the provided data. Never speculate about financial state, specific employees, or specific employers beyond what the data shows.
- The data you receive is already aggregated (counts, sums, trends) — never invent row-level detail that isn't there.
- If the data shows nothing notable, say so plainly rather than manufacturing a finding.
- Flag genuine anomalies (error spikes, failed-login spikes, fraud rule triggers, payment rail degradation) clearly and first.
- Keep the tone terse and operational — this is read by the founder during a live incident, not a report for stakeholders.`;

interface CohereChatResponse {
  text?: string;
  message?: { content?: Array<{ text?: string }> };
}

export async function summarizeWithCohere(userPrompt: string, contextJson: unknown): Promise<string> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY is not configured');
  }

  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'command-r-plus-08-2024',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Operational data (JSON, pre-aggregated, already scoped to what you're allowed to see):\n${JSON.stringify(contextJson)}\n\nQuestion: ${userPrompt}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cohere API error (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as CohereChatResponse;
  const text = data.message?.content?.map((c) => c.text ?? '').join('') ?? data.text;
  if (!text) throw new Error('Cohere response had no text content');
  return text;
}
