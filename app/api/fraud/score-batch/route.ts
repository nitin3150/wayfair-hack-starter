import { NextRequest, NextResponse } from "next/server";
import { scoreClaim, makeDecision } from "@/lib/fraud/scorer";
import { adjustWithLLM } from "@/lib/fraud/llm-adjuster";
import type { BatchScoreRequest, ScoringResult } from "@/lib/fraud/types";

export async function POST(req: NextRequest) {
  const body: BatchScoreRequest = await req.json();
  const { claims, approve_threshold = 40, deny_threshold = 70 } = body;

  const results: ScoringResult[] = await Promise.all(
    claims.map(async (claim) => {
      const breakdown = scoreClaim(claim);
      const llmResult = await adjustWithLLM(claim, breakdown.base_score);
      const { decision, action_text } = makeDecision(llmResult.final_score, approve_threshold, deny_threshold);
      return { claim, score_breakdown: breakdown, llm_result: llmResult, final_score: llmResult.final_score, decision, action_text };
    })
  );

  return NextResponse.json(results);
}
