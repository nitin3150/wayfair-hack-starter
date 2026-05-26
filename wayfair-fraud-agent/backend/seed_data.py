from models import RefundClaim

DEMO_CLAIMS = [
    RefundClaim(
        claim_id="CLM-001",
        customer_name="Sarah Mitchell",
        order_value=849.00,
        customer_ltv=3200.00,
        refund_count_90_days=0,
        account_age_days=847,
        days_since_delivery=5,
        delivery_status="gps_confirmed",
        photo_submitted=True,
        photo_match="matches",
        prior_chargebacks=0,
        claim_filed_within_24hrs_of_delivery=False,
        claim_right_before_window_closes=False,
        claim_text=(
            "The left front leg of the sectional arrived cracked at the joint — "
            "you can see the wood split about 3 inches up from the base. "
            "The delivery team noted it too. Attaching photos from multiple angles."
        ),
    ),
    RefundClaim(
        claim_id="CLM-002",
        customer_name="Marcus Webb",
        order_value=529.00,
        customer_ltv=340.00,
        refund_count_90_days=2,
        account_age_days=210,
        days_since_delivery=27,
        delivery_status="proxy_delivery",
        photo_submitted=False,
        photo_match="not_submitted",
        prior_chargebacks=1,
        claim_filed_within_24hrs_of_delivery=False,
        claim_right_before_window_closes=True,
        claim_text="The item was damaged when I got it. I did not notice until now. I want a refund.",
    ),
    RefundClaim(
        claim_id="CLM-003",
        customer_name="Account_9821",
        order_value=1199.00,
        customer_ltv=67.00,
        refund_count_90_days=4,
        account_age_days=18,
        days_since_delivery=0,
        delivery_status="no_scan",
        photo_submitted=False,
        photo_match="not_submitted",
        prior_chargebacks=2,
        claim_filed_within_24hrs_of_delivery=True,
        claim_right_before_window_closes=False,
        claim_text="Item not received. Want refund now.",
    ),
]
