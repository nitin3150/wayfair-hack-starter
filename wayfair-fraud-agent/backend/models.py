from pydantic import BaseModel
from typing import Literal, Optional


class RefundClaim(BaseModel):
    claim_id: str
    customer_name: str
    order_value: float
    customer_ltv: float
    refund_count_90_days: int
    account_age_days: int
    days_since_delivery: int
    delivery_status: Literal["gps_confirmed", "proxy_delivery", "carrier_exception", "no_scan"]
    photo_submitted: bool
    photo_match: Literal["matches", "generic", "metadata_mismatch", "not_submitted"]
    prior_chargebacks: int
    claim_filed_within_24hrs_of_delivery: bool
    claim_text: str
    claim_right_before_window_closes: bool


class ScoreBreakdown(BaseModel):
    sub_scores: dict
    base_score: int
    top_signals: list


class LLMAdjustment(BaseModel):
    adjustment: int
    reasoning: str
    confidence: str
    final_score: int


class ScoringResult(BaseModel):
    claim: RefundClaim
    score_breakdown: ScoreBreakdown
    llm_result: Optional[LLMAdjustment]
    final_score: int
    decision: str
    action_text: str


class BatchScoreRequest(BaseModel):
    claims: list[RefundClaim]
    approve_threshold: int = 40
    deny_threshold: int = 70
