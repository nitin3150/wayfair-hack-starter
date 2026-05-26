export type DeliveryStatus = "gps_confirmed" | "proxy_delivery" | "carrier_exception" | "no_scan";
export type PhotoMatch = "matches" | "generic" | "metadata_mismatch" | "not_submitted";
export type Decision = "AUTO_APPROVE" | "HUMAN_REVIEW" | "AUTO_DENY";
export type Confidence = "low" | "medium" | "high";

export interface RefundClaim {
  claim_id: string;
  customer_name: string;
  order_value: number;
  customer_ltv: number;
  refund_count_90_days: number;
  account_age_days: number;
  days_since_delivery: number;
  delivery_status: DeliveryStatus;
  photo_submitted: boolean;
  photo_match: PhotoMatch;
  prior_chargebacks: number;
  claim_filed_within_24hrs_of_delivery: boolean;
  claim_text: string;
  claim_right_before_window_closes: boolean;
}

export interface SubScores {
  refund_history: number;
  delivery: number;
  ltv_history: number;
  photo: number;
  payment: number;
}

export interface ScoreBreakdown {
  sub_scores: SubScores;
  base_score: number;
  top_signals: string[];
}

export interface LLMAdjustment {
  adjustment: number;
  reasoning: string;
  confidence: Confidence;
  final_score: number;
}

export interface ScoringResult {
  claim: RefundClaim;
  score_breakdown: ScoreBreakdown;
  llm_result: LLMAdjustment | null;
  final_score: number;
  decision: Decision;
  action_text: string;
}

export interface BatchScoreRequest {
  claims: RefundClaim[];
  approve_threshold: number;
  deny_threshold: number;
}
