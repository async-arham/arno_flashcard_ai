// Utilities for AI-generated flashcards only. No local/automatic generator exists.
export function cleanCards(value, limit = 10) {
  if (!Array.isArray(value)) return [];
  const seenQuestions = new Set();
  const cards = [];
  for (const item of value) {
    const q = typeof item?.q === 'string' ? item.q.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    const a = typeof item?.a === 'string' ? item.a.replace(/\s+/g, ' ').trim().slice(0, 1800) : '';
    if (!q || !a) continue;
    // Reject duplicate questions, even when the AI phrases the answer differently.
    const key = q.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!key || seenQuestions.has(key)) continue;
    seenQuestions.add(key);
    cards.push({ q, a });
    if (cards.length >= limit) break;
  }
  return cards;
}

export function prepareSource(input, limit = 16000) {
  const text = String(input || '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
  if (text.length <= limit) return { text, truncated: false };
  const first = Math.floor(limit * .43);
  const middle = Math.floor(limit * .28);
  const last = limit - first - middle - 100;
  const midStart = Math.floor((text.length - middle) / 2);
  return {
    text: text.slice(0, first) + '\n\n[Middle excerpt; some source text omitted]\n\n' +
      text.slice(midStart, midStart + middle) + '\n\n[Ending excerpt; some source text omitted]\n\n' + text.slice(-last),
    truncated: true,
  };
}

export function parseModelCards(raw) {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  let obj;
  try { obj = JSON.parse(trimmed); } catch { return []; }
  return cleanCards(obj?.cards);
}
