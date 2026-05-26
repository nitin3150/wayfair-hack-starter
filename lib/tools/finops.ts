import { tool } from "ai";
import { z } from "zod";
import {
  findCustomer,
  findOrder,
  getCustomerInteractions,
  getCustomerOrders,
} from "@/lib/data/mock";
import { scoreClaim, makeDecision } from "@/lib/fraud/scorer";
import { adjustWithLLM } from "@/lib/fraud/llm-adjuster";
import type { RefundClaim } from "@/lib/fraud/types";

const TODAY = "2026-05-26";

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ---------------------------------------------------------------------------
// Tool 1: Look up an order
// ---------------------------------------------------------------------------

export const lookupOrder = tool({
  description:
    "Look up a Wayfair order by order ID. Returns order details, delivery date, items, and whether each item is returnable.",
  inputSchema: z.object({
    orderId: z.string().describe("Wayfair order ID, e.g. ORD-1005"),
  }),
  execute: async ({ orderId }) => {
    const order = findOrder(orderId);
    if (!order) {
      return { error: `Order ${orderId} not found.` };
    }
    const customer = findCustomer(order.customerId);
    const daysSinceDelivery = daysBetween(order.deliveryDate, TODAY);
    return {
      orderId: order.orderId,
      customerId: order.customerId,
      customerName: customer?.name ?? "Unknown",
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      daysSinceDelivery,
      items: order.items.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        category: item.category,
        price: item.price,
        nonReturnable: item.nonReturnable,
      })),
      totalAmount: order.totalAmount,
    };
  },
});

// ---------------------------------------------------------------------------
// Tool 2: Get customer history (all past orders + return/appeasement interactions)
// ---------------------------------------------------------------------------

export const getCustomerHistory = tool({
  description:
    "Retrieve a customer's full profile and interaction history: all past orders, returns, and appeasement (damage-claim) credits. Essential for pattern analysis.",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID, e.g. C001"),
  }),
  execute: async ({ customerId }) => {
    const customer = findCustomer(customerId);
    if (!customer) {
      return { error: `Customer ${customerId} not found.` };
    }
    const orders = getCustomerOrders(customerId);
    const interactions = getCustomerInteractions(customerId);
    const returns = interactions.filter((i) => i.type === "return");
    const appeasements = interactions.filter((i) => i.type === "appeasement");
    const totalRefunded = interactions.reduce((sum, i) => sum + i.amountCredited, 0);

    return {
      customer: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        accountCreatedDate: customer.accountCreatedDate,
        totalOrders: customer.totalOrders,
        totalSpend: customer.totalSpend,
      },
      summary: {
        totalOrders: orders.length,
        totalReturns: returns.length,
        totalAppeasements: appeasements.length,
        returnRate: `${Math.round((returns.length / orders.length) * 100)}%`,
        totalRefunded,
      },
      returnHistory: interactions.map((i) => ({
        interactionId: i.interactionId,
        orderId: i.orderId,
        itemName: i.itemName,
        itemValue: i.itemValue,
        type: i.type,
        claimDate: i.claimDate,
        daysSinceDelivery: i.daysSinceDelivery,
        reason: i.reason,
        reasonText: i.reasonText,
        keptItem: i.keptItem,
        resolution: i.resolution,
        amountCredited: i.amountCredited,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Tool 3: Check return eligibility against Wayfair policy
// ---------------------------------------------------------------------------

export const checkReturnEligibility = tool({
  description:
    "Check whether an item from an order is eligible for return under Wayfair's return policy. Applies category-specific windows (30 days standard, 100 days mattress, 48 hours appliance) and non-returnable rules.",
  inputSchema: z.object({
    orderId: z.string().describe("Order ID"),
    itemId: z.string().describe("Item ID within the order"),
  }),
  execute: async ({ orderId, itemId }) => {
    const order = findOrder(orderId);
    if (!order) return { eligible: false, reason: `Order ${orderId} not found.` };

    const item = order.items.find((i) => i.itemId === itemId);
    if (!item) return { eligible: false, reason: `Item ${itemId} not found in order ${orderId}.` };

    const daysSinceDelivery = daysBetween(order.deliveryDate, TODAY);

    if (item.nonReturnable) {
      return {
        eligible: false,
        reason: `${item.name} is marked non-returnable (clearance, personalized, or open box item).`,
        policy: "Non-returnable items",
        daysSinceDelivery,
      };
    }

    if (item.category === "appliance") {
      const eligible = daysSinceDelivery <= 2;
      return {
        eligible,
        reason: eligible
          ? "Appliance is within the 48-hour return window."
          : `Appliance return window is 48 hours. ${daysSinceDelivery} days have passed.`,
        policy: "Large appliances: 48 hours, uninstalled",
        daysRemaining: eligible ? 2 - daysSinceDelivery : 0,
        daysSinceDelivery,
      };
    }

    if (item.category === "mattress") {
      const eligible = daysSinceDelivery <= 100;
      return {
        eligible,
        reason: eligible
          ? `Mattress is within the 100-day return window. ${100 - daysSinceDelivery} days remaining.`
          : `Mattress return window is 100 days. ${daysSinceDelivery} days have passed.`,
        policy: "Mattresses: 100 days, free return shipping",
        daysRemaining: eligible ? 100 - daysSinceDelivery : 0,
        daysSinceDelivery,
      };
    }

    if (["plant", "swatch"].includes(item.category)) {
      return {
        eligible: false,
        reason: `${item.name} (${item.category}) is non-returnable per Wayfair policy.`,
        policy: "Live plants and swatches are non-returnable",
        daysSinceDelivery,
      };
    }

    // Standard items: 30 days
    const eligible = daysSinceDelivery <= 30;
    return {
      eligible,
      reason: eligible
        ? `Item is within the standard 30-day return window. ${30 - daysSinceDelivery} days remaining.`
        : `Standard return window is 30 days. ${daysSinceDelivery} days have passed — window has expired.`,
      policy: "Standard items: 30 days, original undamaged condition",
      daysRemaining: eligible ? 30 - daysSinceDelivery : 0,
      daysSinceDelivery,
    };
  },
});

// ---------------------------------------------------------------------------
// Tool 4: Assess fraud risk
// ---------------------------------------------------------------------------

export const assessFraudRisk = tool({
  description:
    "Compute a fraud/abuse risk score (0–1) for a customer based on their return history. Detects wardrobing, appeasement abuse, serial returning, and damage-claim abuse. Returns score, risk level, signal breakdown, and specific evidence.",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID to assess"),
  }),
  execute: async ({ customerId }) => {
    const customer = findCustomer(customerId);
    if (!customer) return { error: `Customer ${customerId} not found.` };

    const interactions = getCustomerInteractions(customerId);
    const orders = getCustomerOrders(customerId);
    const returns = interactions.filter((i) => i.type === "return");
    const appeasements = interactions.filter((i) => i.type === "appeasement");

    // Signal 1: Wardrobing — returns of high-value items ($300+) in the last 5 days of the window (day 25–30)
    const wardrobingCases = returns.filter(
      (r) => r.daysSinceDelivery >= 25 && r.itemValue >= 300
    );
    const wardrobingRawScore = Math.min(1.0, wardrobingCases.length / 2);

    // Signal 2: Appeasement abuse — keeping items while collecting discounts/credits
    const appeasementRawScore = Math.min(1.0, appeasements.length / 3);

    // Signal 3: Serial returning — return rate above baseline 15%
    const returnRate = orders.length > 0 ? returns.length / orders.length : 0;
    const serialRawScore = Math.max(0, Math.min(1.0, (returnRate - 0.15) / 0.35));

    // Signal 4: Damage claim abuse — repeated DOA/defective claims
    const damageClaims = interactions.filter((i) =>
      ["damaged_on_arrival", "defective", "missing_parts"].includes(i.reason)
    );
    const damageRawScore = Math.min(1.0, damageClaims.length / 3);

    // Weighted composite (weights sum to 1.0)
    const fraudScore =
      wardrobingRawScore * 0.35 +
      appeasementRawScore * 0.30 +
      serialRawScore * 0.25 +
      damageRawScore * 0.10;

    const riskLevel =
      fraudScore >= 0.70
        ? "CRITICAL"
        : fraudScore >= 0.50
        ? "HIGH"
        : fraudScore >= 0.30
        ? "MEDIUM"
        : "LOW";

    const recommendation =
      fraudScore >= 0.70
        ? "Deny and escalate to fraud investigation team. Do not process refund."
        : fraudScore >= 0.50
        ? "Offer store credit only. Flag account for manual review. Require photo documentation."
        : fraudScore >= 0.30
        ? "Approve with store credit as preferred option. Add note to account. Monitor future activity."
        : "Auto-approve per standard policy.";

    return {
      customerId,
      customerName: customer.name,
      fraudScore: Math.round(fraudScore * 100) / 100,
      riskLevel,
      recommendation,
      signals: {
        wardrobing: {
          score: Math.round(wardrobingRawScore * 100) / 100,
          weight: "35%",
          evidence:
            wardrobingCases.length > 0
              ? wardrobingCases.map(
                  (c) =>
                    `${c.itemName} ($${c.itemValue}) returned on day ${c.daysSinceDelivery} — reason: "${c.reasonText}"`
                )
              : ["No wardrobing signals detected"],
        },
        appeasementAbuse: {
          score: Math.round(appeasementRawScore * 100) / 100,
          weight: "30%",
          evidence:
            appeasements.length > 0
              ? appeasements.map(
                  (a) =>
                    `Order ${a.orderId}: claimed "${a.reason}" on ${a.itemName}, kept item, received $${a.amountCredited} credit`
                )
              : ["No appeasement abuse detected"],
        },
        serialReturner: {
          score: Math.round(serialRawScore * 100) / 100,
          weight: "25%",
          returnRate: `${Math.round(returnRate * 100)}%`,
          evidence:
            returnRate > 0.15
              ? [
                  `${returns.length} returns out of ${orders.length} orders (${Math.round(returnRate * 100)}% return rate — threshold: 15%)`,
                ]
              : ["Return rate within normal range"],
        },
        damageClaimAbuse: {
          score: Math.round(damageRawScore * 100) / 100,
          weight: "10%",
          evidence:
            damageClaims.length > 0
              ? damageClaims.map(
                  (d) =>
                    `Order ${d.orderId}: "${d.reason}" on ${d.itemName} — ${d.keptItem ? "kept item" : "returned item"}`
                )
              : ["No damage claim patterns detected"],
        },
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Tool 5: Process resolution — log decision and generate customer response
// ---------------------------------------------------------------------------

export const processResolution = tool({
  description:
    "Log a resolution decision for a return request and generate a professional customer-facing response message. Use after completing eligibility and fraud assessment.",
  inputSchema: z.object({
    orderId: z.string().describe("Order ID being resolved"),
    customerId: z.string().describe("Customer ID"),
    decision: z
      .enum([
        "approve_full_refund",
        "approve_store_credit_only",
        "request_documentation",
        "deny",
        "escalate_to_fraud_team",
      ])
      .describe("Resolution decision"),
    internalReason: z
      .string()
      .describe("Internal reason for the decision (for audit log — not shown to customer)"),
    itemName: z.string().optional().describe("Item name for the response message"),
  }),
  execute: async ({ orderId, customerId, decision, internalReason, itemName }) => {
    const customer = findCustomer(customerId);
    const order = findOrder(orderId);
    const name = customer?.name?.split(" ")[0] ?? "Valued Customer";
    const item = itemName ?? order?.items[0]?.name ?? "your item";

    const responses: Record<string, { customerMessage: string; nextSteps: string }> = {
      approve_full_refund: {
        customerMessage: `Hi ${name}, thank you for reaching out. We've approved your return for the ${item} on order ${orderId}. A full refund of $${order?.totalAmount ?? "—"} will be returned to your original payment method within 5–7 business days once we receive the item. You'll receive a prepaid return shipping label via email shortly.`,
        nextSteps: "Send prepaid return label. Process refund to original payment method on item receipt.",
      },
      approve_store_credit_only: {
        customerMessage: `Hi ${name}, we've reviewed your return request for the ${item} on order ${orderId}. We're happy to help — we can issue a full store credit of $${order?.totalAmount ?? "—"} to your Wayfair account, which can be used on any future order. Please note that original-payment refunds are not available for this order. Would you like to proceed with store credit?`,
        nextSteps: "Await customer confirmation. Issue store credit. Flag account for monitoring.",
      },
      request_documentation: {
        customerMessage: `Hi ${name}, thank you for contacting us about your ${item} (order ${orderId}). To process your request, we'll need a few photos: (1) the item as it currently looks, (2) the original packaging if available, and (3) a close-up of any damage or issue. Please reply to this message with the photos and we'll get your return processed quickly.`,
        nextSteps: "Await photo documentation. Re-evaluate once received. Flag account for manual review.",
      },
      deny: {
        customerMessage: `Hi ${name}, we've reviewed your return request for order ${orderId}. Unfortunately, we're unable to process this return at this time. If you believe this is in error or have additional information, please don't hesitate to contact us and we'll be happy to take another look.`,
        nextSteps: "Document denial in account notes. Escalate if customer disputes.",
      },
      escalate_to_fraud_team: {
        customerMessage: `Hi ${name}, thank you for your patience. Your request for order ${orderId} is currently under review by our customer assurance team. We'll follow up within 2–3 business days with a resolution.`,
        nextSteps: "Route to fraud investigation team immediately. Do not issue any refund until cleared.",
      },
    };

    const { customerMessage, nextSteps } = responses[decision];

    return {
      status: "logged",
      orderId,
      customerId,
      decision,
      internalReason,
      customerMessage,
      nextSteps,
      timestamp: TODAY,
    };
  },
});

// ---------------------------------------------------------------------------
// Tool 6: Score a specific refund claim (rule engine + LLM adjuster)
// ---------------------------------------------------------------------------

export const scoreRefundClaim = tool({
  description:
    "Score a refund claim using a 5-signal rule engine (0-100) plus an AI adjuster. " +
    "Signals: refund history, delivery confirmation, customer LTV/account age, photo quality, prior chargebacks. " +
    "Returns final_score, decision (AUTO_APPROVE / HUMAN_REVIEW / AUTO_DENY), top risk signals, and AI reasoning. " +
    "Call AFTER lookupOrder and getCustomerHistory so you can populate the fields accurately.",
  inputSchema: z.object({
    claim_id: z.string().describe("Order ID or claim reference, e.g. ORD-1005"),
    customer_name: z.string().describe("Customer full name"),
    order_value: z.number().describe("Order total in dollars"),
    customer_ltv: z.number().describe("Customer lifetime value (totalSpend from history)"),
    refund_count_90_days: z.number().int().min(0).describe("Refunds filed by this customer in the last 90 days"),
    account_age_days: z.number().int().min(0).describe("Days since account was created"),
    days_since_delivery: z.number().int().min(0).describe("Days since the item was delivered"),
    delivery_status: z
      .enum(["gps_confirmed", "proxy_delivery", "carrier_exception", "no_scan"])
      .describe(
        "Delivery confirmation type. Use gps_confirmed for standard confirmed deliveries, " +
        "proxy_delivery if left with neighbor/front desk, carrier_exception if delivery was flagged, " +
        "no_scan if no delivery scan exists."
      ),
    photo_submitted: z.boolean().describe("Did the customer submit a photo with their claim?"),
    photo_match: z
      .enum(["matches", "generic", "metadata_mismatch", "not_submitted"])
      .describe(
        "Photo assessment: matches = photo clearly shows the claimed damage, " +
        "generic = photo doesn't show specific damage, " +
        "metadata_mismatch = photo metadata suggests it wasn't taken recently, " +
        "not_submitted = no photo provided."
      ),
    prior_chargebacks: z.number().int().min(0).default(0).describe("Number of prior chargebacks on account (use 0 if unknown)"),
    claim_filed_within_24hrs_of_delivery: z.boolean().describe("Was the claim filed within 24 hours of delivery?"),
    claim_text: z.string().describe("The customer's own description of the issue (their exact words)"),
    claim_right_before_window_closes: z.boolean().describe("Was claim filed within 3 days of the return window closing?"),
  }),
  execute: async (input) => {
    const claim: RefundClaim = input as RefundClaim;
    const breakdown = scoreClaim(claim);
    const llmResult = await adjustWithLLM(claim, breakdown.base_score);
    const { decision, action_text } = makeDecision(llmResult.final_score, 40, 70);

    const riskLevel =
      llmResult.final_score < 40 ? "LOW" : llmResult.final_score <= 70 ? "MEDIUM" : "HIGH";

    return {
      final_score: llmResult.final_score,
      base_score: breakdown.base_score,
      risk_level: riskLevel,
      decision,
      action_text,
      sub_scores: breakdown.sub_scores,
      top_signals: breakdown.top_signals,
      ai_analysis:
        breakdown.base_score >= 30 && breakdown.base_score <= 80
          ? {
              adjustment: llmResult.adjustment,
              reasoning: llmResult.reasoning,
              confidence: llmResult.confidence,
            }
          : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const finopsTools = {
  lookupOrder,
  getCustomerHistory,
  checkReturnEligibility,
  assessFraudRisk,
  scoreRefundClaim,
  processResolution,
};
