/**
 * Fran's Boutique — AI assistant (Netlify Function)
 * Key lives ONLY in Netlify env vars:
 *   ANTHROPIC_API_KEY = sk-ant-...   (default)
 *   OPENAI_API_KEY    = sk-...       (fallback)
 */

const SYSTEM_PROMPT = `You are Fran's Assistant, the friendly shop helper for Fran's Boutique,
a family-run online boutique shipping from Colorado. The shop has three collections:
- The Find: one-of-a-kind vintage clothing, decor, and curiosities (most items are 1 of 1 — once sold, gone)
- The Studio: handcrafted jewelry and original art from independent makers
- The Shelf: a small selection of new goods
Policies: orders pack within 2 business days and ship with tracking; returns accepted on unworn,
undamaged items within 14 days. Payment is by card (Stripe) or PayPal at checkout.
Be warm, concise (2-4 sentences), and helpful. If asked about a specific item's availability,
suggest checking the collection page since one-of-a-kind pieces sell fast. Never invent discounts,
prices, or policies beyond the above. If a question is unrelated to the boutique, politely steer back.`;

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let messages;
  try {
    ({ messages } = JSON.parse(event.body || "{}"));
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
    messages = messages.slice(-12).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 2000)
    }));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad request" }) };
  }

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || "Anthropic API error");
      const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
    }

    if (process.env.OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || "OpenAI API error");
      const reply = (data.choices?.[0]?.message?.content || "").trim();
      return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
    }

    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Assistant not configured yet — add ANTHROPIC_API_KEY (or OPENAI_API_KEY) in Netlify environment variables." })
    };
  } catch (err) {
    console.error("chat function error:", err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "The assistant is unavailable right now — please try again." }) };
  }
};
