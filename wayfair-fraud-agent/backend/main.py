import asyncio
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from models import RefundClaim, ScoringResult, BatchScoreRequest
from scorer import score_claim
from llm_adjuster import adjust_with_llm
from seed_data import DEMO_CLAIMS

app = FastAPI(title="Wayfair Refund Fraud Detection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def make_decision(final_score: int, approve_threshold: int, deny_threshold: int) -> tuple[str, str]:
    if final_score < approve_threshold:
        decision = "AUTO_APPROVE"
        action = "Trigger refund immediately. Draft apology + resolution email."
    elif final_score > deny_threshold:
        decision = "AUTO_DENY"
        action = "Block refund. Offer $25 store credit as goodwill. Log to fraud watchlist."
    else:
        decision = "HUMAN_REVIEW"
        action = "Flag for senior rep. Pre-draft resolution options."
    return decision, action


async def score_one(
    claim: RefundClaim,
    approve_threshold: int,
    deny_threshold: int,
) -> ScoringResult:
    breakdown = score_claim(claim)
    llm_result = await adjust_with_llm(claim, breakdown.base_score)
    final_score = llm_result.final_score
    decision, action_text = make_decision(final_score, approve_threshold, deny_threshold)

    return ScoringResult(
        claim=claim,
        score_breakdown=breakdown,
        llm_result=llm_result,
        final_score=final_score,
        decision=decision,
        action_text=action_text,
    )


@app.post("/score")
async def score_endpoint(
    claim: RefundClaim,
    approve_threshold: int = Query(default=40),
    deny_threshold: int = Query(default=70),
) -> ScoringResult:
    return await score_one(claim, approve_threshold, deny_threshold)


@app.post("/score-batch")
async def score_batch(body: BatchScoreRequest) -> list[ScoringResult]:
    tasks = [
        score_one(claim, body.approve_threshold, body.deny_threshold)
        for claim in body.claims
    ]
    return await asyncio.gather(*tasks)


@app.get("/demo-claims")
async def demo_claims() -> list[RefundClaim]:
    return DEMO_CLAIMS
