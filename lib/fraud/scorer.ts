import type { RefundClaim, ScoreBreakdown, SubScores } from "./types";

export function scoreClaim(claim: RefundClaim): ScoreBreakdown {
  const signals: [number, string][] = [];

  // Refund History (0-30)
  let rhBase: number;
  let rhDesc: string;
  if (claim.refund_count_90_days === 0) {
    rhBase = 0; rhDesc = "";
  } else if (claim.refund_count_90_days === 1) {
    rhBase = 8; rhDesc = "1 refund in 90 days";
  } else if (claim.refund_count_90_days <= 3) {
    rhBase = 18; rhDesc = `${claim.refund_count_90_days} refunds in 90 days`;
  } else {
    rhBase = 28; rhDesc = `${claim.refund_count_90_days} refunds in 90 days`;
  }
  const rhBonus = claim.claim_right_before_window_closes ? 5 : 0;
  const rhTotal = Math.min(rhBase + rhBonus, 30);
  if (rhTotal > 0) {
    const desc = rhBase > 0 && rhBonus ? `${rhDesc}, near window close` : (rhDesc || "Claim filed near window close");
    signals.push([rhTotal, `${desc} (+${rhTotal} pts)`]);
  }

  // Delivery Confirmation (0-25)
  const deliveryMap: Record<string, [number, string]> = {
    gps_confirmed: [0, ""],
    proxy_delivery: [8, "Proxy delivery"],
    carrier_exception: [14, "Carrier exception on delivery"],
    no_scan: [20, "No delivery scan"],
  };
  const [dcBase, dcDesc] = deliveryMap[claim.delivery_status];
  const dcBonus = claim.claim_filed_within_24hrs_of_delivery ? 5 : 0;
  const dcTotal = Math.min(dcBase + dcBonus, 25);
  if (dcTotal > 0) {
    const desc = dcBase > 0 && dcBonus ? `${dcDesc}, claimed within 24hrs` : (dcDesc || "Claimed within 24hrs of delivery");
    signals.push([dcTotal, `${desc} (+${dcTotal} pts)`]);
  }

  // LTV / History (0-20)
  let ltvBase: number;
  let ltvDesc: string;
  if (claim.customer_ltv > 2000) {
    ltvBase = 0; ltvDesc = "";
  } else if (claim.customer_ltv >= 500) {
    ltvBase = 5; ltvDesc = `LTV $${claim.customer_ltv.toLocaleString()}`;
  } else if (claim.customer_ltv >= 100) {
    ltvBase = 12; ltvDesc = `LTV $${Math.round(claim.customer_ltv).toLocaleString()}`;
  } else {
    ltvBase = 15; ltvDesc = "LTV < $100";
  }
  const ageBonus = claim.account_age_days < 30 ? 5 : 0;
  const ltvTotal = Math.min(ltvBase + ageBonus, 20);
  if (ltvTotal > 0) {
    const desc = ltvBase > 0 && ageBonus
      ? `${ltvDesc}, account age < 30 days`
      : (ageBonus ? "Account age < 30 days" : ltvDesc);
    signals.push([ltvTotal, `${desc} (+${ltvTotal} pts)`]);
  }

  // Photo (0-15)
  const photoMap: Record<string, [number, string]> = {
    matches: [0, ""],
    not_submitted: [8, "No photo submitted"],
    generic: [12, "Generic photo submitted"],
    metadata_mismatch: [15, "Photo metadata mismatch"],
  };
  const [photoTotal, photoDesc] = photoMap[claim.photo_match];
  if (photoTotal > 0) {
    signals.push([photoTotal, `${photoDesc} (+${photoTotal} pts)`]);
  }

  // Payment / Chargeback (0-10)
  let cbTotal: number;
  let cbDesc: string;
  if (claim.prior_chargebacks === 0) {
    cbTotal = 0; cbDesc = "";
  } else if (claim.prior_chargebacks === 1) {
    cbTotal = 5; cbDesc = "1 prior chargeback";
  } else {
    cbTotal = 10; cbDesc = `${claim.prior_chargebacks} prior chargebacks`;
  }
  if (cbTotal > 0) {
    signals.push([cbTotal, `${cbDesc} (+${cbTotal} pts)`]);
  }

  const sub_scores: SubScores = {
    refund_history: rhTotal,
    delivery: dcTotal,
    ltv_history: ltvTotal,
    photo: photoTotal,
    payment: cbTotal,
  };

  const base_score = Object.values(sub_scores).reduce((a, b) => a + b, 0);
  signals.sort((a, b) => b[0] - a[0]);
  const top_signals = signals.slice(0, 3).map(([, s]) => s);

  return { sub_scores, base_score, top_signals };
}

export function makeDecision(
  finalScore: number,
  approveThreshold: number,
  denyThreshold: number
): { decision: "AUTO_APPROVE" | "HUMAN_REVIEW" | "AUTO_DENY"; action_text: string } {
  if (finalScore < approveThreshold) {
    return {
      decision: "AUTO_APPROVE",
      action_text: "Trigger refund immediately. Draft apology + resolution email.",
    };
  }
  if (finalScore > denyThreshold) {
    return {
      decision: "AUTO_DENY",
      action_text: "Block refund. Offer $25 store credit as goodwill. Log to fraud watchlist.",
    };
  }
  return {
    decision: "HUMAN_REVIEW",
    action_text: "Flag for senior rep. Pre-draft resolution options.",
  };
}
