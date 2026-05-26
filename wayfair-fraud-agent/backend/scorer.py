from models import RefundClaim, ScoreBreakdown


def score_claim(claim: RefundClaim) -> ScoreBreakdown:
    signals: list[tuple[int, str]] = []

    # --- Refund History (0-30) ---
    if claim.refund_count_90_days == 0:
        rh_base, rh_desc = 0, None
    elif claim.refund_count_90_days == 1:
        rh_base, rh_desc = 8, "1 refund in 90 days"
    elif claim.refund_count_90_days <= 3:
        rh_base, rh_desc = 18, f"{claim.refund_count_90_days} refunds in 90 days"
    else:
        rh_base, rh_desc = 28, f"{claim.refund_count_90_days} refunds in 90 days"

    rh_bonus = 5 if claim.claim_right_before_window_closes else 0
    rh_total = min(rh_base + rh_bonus, 30)

    if rh_total > 0:
        desc = rh_desc or "Claim filed near window close"
        if rh_bonus and rh_base:
            desc += ", near window close"
        signals.append((rh_total, f"{desc} (+{rh_total} pts)"))

    # --- Delivery Confirmation (0-25) ---
    delivery_map = {
        "gps_confirmed": (0, None),
        "proxy_delivery": (8, "Proxy delivery"),
        "carrier_exception": (14, "Carrier exception on delivery"),
        "no_scan": (20, "No delivery scan"),
    }
    dc_base, dc_desc = delivery_map[claim.delivery_status]
    dc_bonus = 5 if claim.claim_filed_within_24hrs_of_delivery else 0
    dc_total = min(dc_base + dc_bonus, 25)

    if dc_total > 0:
        desc = dc_desc or "Claim filed within 24hrs of delivery"
        if dc_bonus and dc_base:
            desc += ", claimed within 24hrs"
        signals.append((dc_total, f"{desc} (+{dc_total} pts)"))

    # --- Order History / LTV (0-20) ---
    if claim.customer_ltv > 2000:
        ltv_base, ltv_desc = 0, None
    elif claim.customer_ltv >= 500:
        ltv_base, ltv_desc = 5, f"LTV ${claim.customer_ltv:,.0f}"
    elif claim.customer_ltv >= 100:
        ltv_base, ltv_desc = 12, f"LTV ${claim.customer_ltv:,.0f}"
    else:
        ltv_base, ltv_desc = 15, f"LTV < $100"

    age_bonus = 5 if claim.account_age_days < 30 else 0
    ltv_total = min(ltv_base + age_bonus, 20)

    if ltv_total > 0:
        if age_bonus and ltv_base:
            desc = f"{ltv_desc}, account age < 30 days"
        elif age_bonus:
            desc = "Account age < 30 days"
        else:
            desc = ltv_desc
        signals.append((ltv_total, f"{desc} (+{ltv_total} pts)"))

    # --- Damage Photo (0-15) ---
    photo_map = {
        "matches": (0, None),
        "not_submitted": (8, "No photo submitted"),
        "generic": (12, "Generic photo submitted"),
        "metadata_mismatch": (15, "Photo metadata mismatch"),
    }
    photo_total, photo_desc = photo_map[claim.photo_match]
    if photo_total > 0:
        signals.append((photo_total, f"{photo_desc} (+{photo_total} pts)"))

    # --- Payment / Chargeback (0-10) ---
    if claim.prior_chargebacks == 0:
        cb_total, cb_desc = 0, None
    elif claim.prior_chargebacks == 1:
        cb_total, cb_desc = 5, "1 prior chargeback"
    else:
        cb_total, cb_desc = 10, f"{claim.prior_chargebacks} prior chargebacks"

    if cb_total > 0:
        signals.append((cb_total, f"{cb_desc} (+{cb_total} pts)"))

    sub_scores = {
        "refund_history": rh_total,
        "delivery": dc_total,
        "ltv_history": ltv_total,
        "photo": photo_total,
        "payment": cb_total,
    }
    base_score = sum(sub_scores.values())
    signals.sort(key=lambda x: x[0], reverse=True)
    top_signals = [sig for _, sig in signals[:3]]

    return ScoreBreakdown(
        sub_scores=sub_scores,
        base_score=base_score,
        top_signals=top_signals,
    )
