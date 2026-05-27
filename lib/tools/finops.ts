import { tool } from "ai";
import { z } from "zod";
import {
  findCustomer,
  findOrder,
  getCustomerInteractions,
  getCustomerOrders,
} from "@/lib/data/mock";

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
// Tool 4: Assess fraud risk — deterministic rule-based engine (0-100)
// ---------------------------------------------------------------------------

export const assessFraudRisk = tool({
  description:
    "Compute a deterministic fraud risk score (0–100) for a specific return request using a pure rule-based engine. Returns a ScoreBreakdown with sub_scores, base_score, and top_signals. Always call after lookupOrder and getCustomerHistory.",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID"),
    orderId: z.string().describe("Order ID for the current return request"),
  }),
  execute: async ({ customerId, orderId }) => {
    const customer = findCustomer(customerId);
    const order = findOrder(orderId);
    if (!customer) return { error: `Customer ${customerId} not found.` };
    if (!order) return { error: `Order ${orderId} not found.` };

    const interactions = getCustomerInteractions(customerId);

    // ── 1. REFUND HISTORY SCORE (0-30) ───────────────────────────────────────
    // Count all interactions (returns + appeasements) in the last 90 days
    const cutoff = new Date(TODAY);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const recent = interactions.filter((i) => i.claimDate >= cutoffStr);
    const refundCount90 = recent.length;

    const refundBase =
      refundCount90 === 0 ? 0
      : refundCount90 === 1 ? 8
      : refundCount90 <= 3 ? 18
      : 28;

    // Bonus if customer has a pattern of filing claims in the last 5 days of the 30-day window
    const hasLateWindowPattern = interactions.some(
      (i) => i.daysSinceDelivery >= 25
    );
    const refundBonus = hasLateWindowPattern ? 5 : 0;
    const refundScore = Math.min(30, refundBase + refundBonus);

    // ── 2. DELIVERY CONFIRMATION SCORE (0-25) ────────────────────────────────
    const deliveryBaseMap: Record<string, number> = {
      gps_confirmed: 0,
      proxy_delivery: 8,
      carrier_exception: 14,
      no_scan: 20,
    };
    const deliveryBase = deliveryBaseMap[order.deliveryConfirmation] ?? 0;
    const deliveryBonus = order.claimFiledWithin24HrsOfDelivery ? 5 : 0;
    const deliveryScore = Math.min(25, deliveryBase + deliveryBonus);

    // ── 3. ORDER HISTORY / LTV SCORE (0-20) ──────────────────────────────────
    const ltv = customer.totalSpend;
    const ltvBase =
      ltv > 2000 ? 0
      : ltv >= 500 ? 5
      : ltv >= 100 ? 12
      : 15;

    const accountAgeDays = daysBetween(customer.accountCreatedDate, TODAY);
    const ltvBonus = accountAgeDays < 30 ? 5 : 0;
    const ltvScore = Math.min(20, ltvBase + ltvBonus);

    // ── 4. DAMAGE PHOTO SCORE (0-15) ─────────────────────────────────────────
    const photoScoreMap: Record<string, number> = {
      matches: 0,
      not_submitted: 8,
      generic: 12,
      metadata_mismatch: 15,
    };
    const photoScore = photoScoreMap[order.damagePhotoStatus] ?? 0;

    // ── 5. PAYMENT / CHARGEBACK SCORE (0-10) ─────────────────────────────────
    const chargebackScore =
      customer.priorChargebacks === 0 ? 0
      : customer.priorChargebacks === 1 ? 5
      : 10;

    // ── Composite ────────────────────────────────────────────────────────────
    const baseScore =
      refundScore + deliveryScore + ltvScore + photoScore + chargebackScore;

    // ── Top signals: collect all contributing components, sort descending ────
    const signals: Array<{ label: string; pts: number }> = [];

    if (refundBase > 0) {
      signals.push({
        label: `${refundCount90} refund${refundCount90 > 1 ? "s" : ""} in last 90 days`,
        pts: refundBase,
      });
    }
    if (refundBonus > 0) {
      signals.push({ label: "Prior claims filed near window deadline", pts: refundBonus });
    }
    if (deliveryBase > 0) {
      const deliveryLabels: Record<string, string> = {
        proxy_delivery: "Proxy delivery (delivered to neighbor/proxy)",
        carrier_exception: "Carrier exception on delivery",
        no_scan: "No delivery scan at destination",
      };
      signals.push({
        label: deliveryLabels[order.deliveryConfirmation] ?? order.deliveryConfirmation,
        pts: deliveryBase,
      });
    }
    if (deliveryBonus > 0) {
      signals.push({ label: "Claim filed within 24 hrs of delivery", pts: deliveryBonus });
    }
    if (ltvBase > 0) {
      signals.push({ label: `Low account LTV ($${ltv})`, pts: ltvBase });
    }
    if (ltvBonus > 0) {
      signals.push({ label: "Account age < 30 days", pts: ltvBonus });
    }
    if (photoScore > 0) {
      const photoLabels: Record<string, string> = {
        not_submitted: "Damage photo not submitted",
        generic: "Generic/stock damage photos submitted",
        metadata_mismatch: "Damage photo metadata mismatch",
      };
      signals.push({
        label: photoLabels[order.damagePhotoStatus] ?? order.damagePhotoStatus,
        pts: photoScore,
      });
    }
    if (chargebackScore > 0) {
      signals.push({
        label: `${customer.priorChargebacks} prior chargeback${customer.priorChargebacks > 1 ? "s" : ""}`,
        pts: chargebackScore,
      });
    }

    signals.sort((a, b) => b.pts - a.pts);
    const topSignals = signals
      .slice(0, 3)
      .map((s) => `${s.label} (+${s.pts} pts)`);

    // ── Risk level & recommendation ──────────────────────────────────────────
    const riskLevel =
      baseScore >= 76 ? "CRITICAL"
      : baseScore >= 51 ? "HIGH"
      : baseScore >= 26 ? "MEDIUM"
      : "LOW";

    const recommendation =
      baseScore >= 76
        ? "Deny and escalate to fraud investigation team. Do not process any refund."
        : baseScore >= 51
        ? "Store credit only. Require photo documentation before processing. Flag account for manual review."
        : baseScore >= 26
        ? "Approve with store credit as preferred option. Add note to account. Monitor future activity."
        : "Auto-approve per standard policy. Full refund to original payment method.";

    return {
      customerId,
      orderId,
      scoreBreakdown: {
        sub_scores: {
          refundHistory: { score: refundScore, max: 30 },
          deliveryConfirmation: { score: deliveryScore, max: 25 },
          orderHistoryLtv: { score: ltvScore, max: 20 },
          damagePhoto: { score: photoScore, max: 15 },
          paymentChargeback: { score: chargebackScore, max: 10 },
        },
        base_score: baseScore,
        top_signals: topSignals,
      },
      riskLevel,
      recommendation,
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
// Exports
// ---------------------------------------------------------------------------

export const finopsTools = {
  lookupOrder,
  getCustomerHistory,
  checkReturnEligibility,
  assessFraudRisk,
  processResolution,
};
