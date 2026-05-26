import json
import os
from models import RefundClaim, LLMAdjustment

import anthropic


SYSTEM_PROMPT = """You are a fraud risk analyst at a furniture ecommerce company. \
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
- High LTV customer with clean history"""


async def adjust_with_llm(claim: RefundClaim, base_score: int) -> LLMAdjustment:
    if base_score < 30 or base_score > 80:
        return LLMAdjustment(
            adjustment=0,
            reasoning="Score outside LLM range, rule score used",
            confidence="high",
            final_score=base_score,
        )

    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        user_message = (
            f"Base risk score: {base_score}\n"
            f"Claim text: '{claim.claim_text}'\n"
            f"Order value: ${claim.order_value}\n"
            f"Days since delivery: {claim.days_since_delivery}\n"
            f"Prior refunds in 90 days: {claim.refund_count_90_days}\n"
            f"Delivery status: {claim.delivery_status}\n"
            f"Photo submitted: {claim.photo_submitted}"
        )

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        data = json.loads(raw)

        adjustment = max(-15, min(15, int(data["adjustment"])))
        final_score = max(0, min(100, base_score + adjustment))

        return LLMAdjustment(
            adjustment=adjustment,
            reasoning=data["reasoning"],
            confidence=data["confidence"],
            final_score=final_score,
        )

    except Exception:
        return LLMAdjustment(
            adjustment=0,
            reasoning="LLM unavailable, rule score used",
            confidence="low",
            final_score=base_score,
        )
