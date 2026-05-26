import { NextRequest, NextResponse } from "next/server";
import { scoreClaim, makeDecision } from "@/lib/fraud/scorer";
import { adjustWithLLM } from "@/lib/fraud/llm-adjuster";
import type { RefundClaim, ScoringResult } from "@/lib/fraud/types";

export async function POST(req: NextRequest) {
  const claim: RefundClaim = await req.json();
  const approveThreshold = Number(req.nextUrl.searchParams.get("approve_threshold") ?? 40);
  const denyThreshold = Number(req.nextUrl.searchParams.get("deny_threshold") ?? 70);

  const breakdown = scoreClaim(claim);
  const llmResult = await adjustWithLLM(claim, breakdown.base_score);
  const { decision, action_text } = makeDecision(llmResult.final_score, approveThreshold, denyThreshold);

  const result: ScoringResult = {
    claim,
    score_breakdown: breakdown,
    llm_result: llmResult,
    final_score: llmResult.final_score,
    decision,
    action_text,
  };

  return NextResponse.json(result);
}
