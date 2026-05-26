import Anthropic from "@anthropic-ai/sdk";
import type { RefundClaim, LLMAdjustment } from "./types";

const SYSTEM_PROMPT = `You are a fraud risk analyst at a furniture ecommerce company. \
A customer filed a refund claim. Analyze the claim text and context for subtle fraud signals that rules cannot catch.

Output ONLY valid JSON with exactly these keys:
{
  "adjustment": <integer between -15 and 15>,
  "reasoning": "<one sentence, max 20 words>",
  "confidence": "<low|medium|high>"
}

Positive adjustment = more suspicious.
Negative adjustment = more credible / less suspicious.

Signals that raise suspicion:
- Vague or generic damage descriptions
- Claim filed suspiciously fast
- Inconsistencies between claim text and delivery data
- Language patterns matching scripted abuse

Signals that lower suspicion:
- Specific, detailed damage descriptions
- Consistent story across all data points
- High LTV customer with clean history`;

export async function adjustWithLLM(claim: RefundClaim, baseScore: number): Promise<LLMAdjustment> {
  if (baseScore < 30 || baseScore > 80) {
    return { adjustment: 0, reasoning: "Score outside LLM range, rule score used", confidence: "high", final_score: baseScore };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userMessage = `Base risk score: ${baseScore}
Claim text: '${claim.claim_text}'
Order value: $${claim.order_value}
Days since delivery: ${claim.days_since_delivery}
Prior refunds in 90 days: ${claim.refund_count_90_days}
Delivery status: ${claim.delivery_status}
Photo submitted: ${claim.photo_submitted}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    const data = JSON.parse(raw);

    const adjustment = Math.max(-15, Math.min(15, Math.round(Number(data.adjustment))));
    const final_score = Math.max(0, Math.min(100, baseScore + adjustment));

    return {
      adjustment,
      reasoning: String(data.reasoning),
      confidence: data.confidence as "low" | "medium" | "high",
      final_score,
    };
  } catch {
    return { adjustment: 0, reasoning: "LLM unavailable, rule score used", confidence: "low", final_score: baseScore };
  }
}
