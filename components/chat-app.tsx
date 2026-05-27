"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useEffect, useRef, useState } from "react";
import { CUSTOMERS, getCustomerOrders } from "@/lib/data/mock";
import type { Order } from "@/lib/data/mock";

const TODAY = new Date("2026-05-26");

function daysSince(dateStr: string): number {
  return Math.floor(
    (TODAY.getTime() - new Date(dateStr).getTime()) / 86400000
  );
}

const TOOL_LABELS: Record<string, string> = {
  lookupOrder: "Look up order",
  getCustomerHistory: "Review account history",
  checkReturnEligibility: "Check return eligibility",
  assessFraudRisk: "Analyze fraud risk",
  processResolution: "Process resolution",
};

type FlowStep = "welcome" | "selecting" | "confirming" | "processing" | "done";

// ─── Types for extracted tool outputs ────────────────────────────────────────

interface PolicyResult {
  eligible: boolean;
  reason: string;
  daysRemaining?: number;
  policy: string;
  daysSinceDelivery: number;
}

interface FraudResult {
  scoreBreakdown: {
    sub_scores: {
      refundHistory: { score: number; max: number };
      deliveryConfirmation: { score: number; max: number };
      orderHistoryLtv: { score: number; max: number };
      damagePhoto: { score: number; max: number };
      paymentChargeback: { score: number; max: number };
    };
    base_score: number;
    top_signals: string[];
  };
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string;
}

interface ResolutionResult {
  decision: string;
  customerMessage: string;
  internalReason: string;
  nextSteps: string;
}

// ─── Tool output extractor ────────────────────────────────────────────────────

function getOutput(part: UIMessage["parts"][number]): unknown {
  const p = part as Record<string, unknown>;
  // Try both field names used across AI SDK versions
  return p.output ?? p.result ?? null;
}

function extractPanelData(messages: UIMessage[]) {
  let policy: PolicyResult | null = null;
  let fraud: FraudResult | null = null;
  let resolution: ResolutionResult | null = null;
  const toolActivity: Array<{ name: string; state: string }> = [];

  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith("tool-")) continue;
      const toolName = part.type.replace("tool-", "");
      const state = "state" in part ? (part.state as string) : "";

      // Track activity for all tools
      const existing = toolActivity.find((t) => t.name === toolName);
      if (existing) {
        existing.state = state;
      } else {
        toolActivity.push({ name: toolName, state });
      }

      if (state !== "output-available") continue;
      const out = getOutput(part);
      if (!out) continue;

      if (toolName === "checkReturnEligibility") policy = out as PolicyResult;
      if (toolName === "assessFraudRisk") fraud = out as FraudResult;
      if (toolName === "processResolution") resolution = out as ResolutionResult;
    }
  }

  return { toolActivity, policy, fraud, resolution };
}

// ─── Demo panel sub-components ────────────────────────────────────────────────

function ScoreBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = Math.round((score / max) * 100);
  const fill = score === 0 ? "bg-gray-200" : "bg-[#5c2d91]";
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono text-gray-800">
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-green-100 text-green-700 border-green-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const DECISION_STYLES: Record<string, string> = {
  approve_full_refund: "text-green-700",
  approve_store_credit_only: "text-amber-700",
  request_documentation: "text-orange-700",
  deny: "text-red-700",
  escalate_to_fraud_team: "text-red-700",
};

function DemoPanel({
  toolActivity,
  policy,
  fraud,
  resolution,
  isBusy,
}: {
  toolActivity: Array<{ name: string; state: string }>;
  policy: PolicyResult | null;
  fraud: FraudResult | null;
  resolution: ResolutionResult | null;
  isBusy: boolean;
}) {
  const orderedTools = [
    "lookupOrder",
    "getCustomerHistory",
    "checkReturnEligibility",
    "assessFraudRisk",
    "processResolution",
  ];

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#5c2d91] px-4 py-3">
        <p className="text-sm font-semibold text-white">Internal Demo View</p>
        <p className="text-xs text-purple-200">Not visible to customer</p>
      </div>

      {/* Agent activity */}
      <section className="border-b border-gray-200 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Agent Activity
        </h3>
        <div className="space-y-2">
          {orderedTools.map((name) => {
            const activity = toolActivity.find((t) => t.name === name);
            const state = activity?.state ?? "pending";
            const done = state === "output-available";
            const errored = state === "output-error";
            const active = state === "input-available";
            return (
              <div key={name} className="flex items-center gap-2 text-xs">
                {errored ? (
                  <span className="text-red-400">✗</span>
                ) : done ? (
                  <span className="text-green-500">✓</span>
                ) : active ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#5c2d91] border-t-transparent" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-gray-300" />
                )}
                <span
                  className={
                    done
                      ? "text-gray-700"
                      : active
                      ? "font-medium text-[#5c2d91]"
                      : "text-gray-400"
                  }
                >
                  {TOOL_LABELS[name] ?? name}
                </span>
              </div>
            );
          })}
        </div>
        {isBusy && (
          <p className="mt-3 text-xs italic text-gray-400">Running…</p>
        )}
      </section>

      {/* Policy check */}
      {policy && (
        <section className="border-b border-gray-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Policy Check
          </h3>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              policy.eligible
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span>{policy.eligible ? "✓ Eligible" : "✗ Not eligible"}</span>
          </div>
          <p className="mt-2 text-xs text-gray-600">{policy.reason}</p>
          {policy.policy && (
            <p className="mt-1 text-xs text-gray-400">{policy.policy}</p>
          )}
        </section>
      )}

      {/* Fraud score */}
      {fraud && (
        <section className="border-b border-gray-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Fraud Score
          </h3>

          {/* Big score + level */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-3xl font-bold text-gray-900">
                {fraud.scoreBreakdown.base_score}
              </span>
              <span className="text-sm text-gray-400">/100</span>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                RISK_STYLES[fraud.riskLevel] ?? ""
              }`}
            >
              {fraud.riskLevel}
            </span>
          </div>

          {/* Score bar */}
          <div className="mb-1 h-2 w-full rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full ${
                fraud.riskLevel === "CRITICAL"
                  ? "bg-red-500"
                  : fraud.riskLevel === "HIGH"
                  ? "bg-orange-400"
                  : fraud.riskLevel === "MEDIUM"
                  ? "bg-amber-400"
                  : "bg-green-400"
              }`}
              style={{ width: `${fraud.scoreBreakdown.base_score}%` }}
            />
          </div>
          <div className="mb-4 flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>

          {/* Sub-scores */}
          <ScoreBar
            label="Refund History"
            score={fraud.scoreBreakdown.sub_scores.refundHistory.score}
            max={fraud.scoreBreakdown.sub_scores.refundHistory.max}
          />
          <ScoreBar
            label="Delivery Confirmation"
            score={fraud.scoreBreakdown.sub_scores.deliveryConfirmation.score}
            max={fraud.scoreBreakdown.sub_scores.deliveryConfirmation.max}
          />
          <ScoreBar
            label="Account / LTV"
            score={fraud.scoreBreakdown.sub_scores.orderHistoryLtv.score}
            max={fraud.scoreBreakdown.sub_scores.orderHistoryLtv.max}
          />
          <ScoreBar
            label="Damage Photo"
            score={fraud.scoreBreakdown.sub_scores.damagePhoto.score}
            max={fraud.scoreBreakdown.sub_scores.damagePhoto.max}
          />
          <ScoreBar
            label="Chargebacks"
            score={fraud.scoreBreakdown.sub_scores.paymentChargeback.score}
            max={fraud.scoreBreakdown.sub_scores.paymentChargeback.max}
          />

          {/* Top signals */}
          {fraud.scoreBreakdown.top_signals.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-gray-500">
                Top signals
              </p>
              <ul className="space-y-1">
                {fraud.scoreBreakdown.top_signals.map((sig, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                    <span className="mt-0.5 shrink-0 text-[#5c2d91]">▸</span>
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Decision */}
      {resolution && (
        <section className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Decision
          </h3>
          <p
            className={`text-sm font-semibold ${
              DECISION_STYLES[resolution.decision] ?? "text-gray-800"
            }`}
          >
            {resolution.decision.replace(/_/g, " ").toUpperCase()}
          </p>
          {resolution.internalReason && (
            <p className="mt-2 text-xs text-gray-600">
              {resolution.internalReason}
            </p>
          )}
          {resolution.nextSteps && (
            <p className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
              {resolution.nextSteps}
            </p>
          )}
        </section>
      )}

      {/* Empty state */}
      {!policy && !fraud && !resolution && !isBusy && (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-gray-400">
          Analysis will appear here as the agent runs.
        </div>
      )}
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (id: string) => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <div className="mb-10 text-center">
        <div className="text-4xl font-bold tracking-tight text-[#5c2d91]">
          wayfair
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Select a demo account to continue
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {CUSTOMERS.map((c) => (
          <button
            key={c.customerId}
            onClick={() => onLogin(c.customerId)}
            className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-[#5c2d91] hover:bg-purple-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5c2d91] text-xs font-bold text-white">
              {c.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {c.name}
              </div>
              <div className="text-xs text-gray-400">{c.customerId}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const item = order.items[0];
  const days = daysSince(order.deliveryDate);
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-[#5c2d91] hover:bg-purple-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">
            {item.name}
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            {order.orderId} · Delivered {order.deliveryDate}
          </div>
        </div>
        <div className="shrink-0 text-sm font-semibold text-gray-900">
          ${item.price}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
          {item.category}
        </span>
        <span className="text-xs text-gray-400">{days} days since delivery</span>
      </div>
    </button>
  );
}

// ─── Chat bubbles ─────────────────────────────────────────────────────────────

function VaBubble({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-400">Virtual Assistant</div>
      <div className="text-sm leading-relaxed text-gray-800">{children}</div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-2xl bg-[#e9e9eb] px-4 py-2.5">
        <p className="text-sm text-gray-900">{text}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatApp() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode: "agent" },
      }),
    []
  );

  const { messages, sendMessage, status, stop } = useChat({ transport });
  const isBusy = status === "streaming" || status === "submitted";

  const customer = CUSTOMERS.find((c) => c.customerId === customerId) ?? null;
  const customerOrders = customerId ? getCustomerOrders(customerId) : [];
  const selectedOrder =
    customerOrders.find((o) => o.orderId === selectedOrderId) ?? null;

  // Extract structured tool outputs for the demo panel
  const { toolActivity, policy, fraud, resolution } = useMemo(
    () => extractPanelData(messages),
    [messages]
  );

  const showPanel = flowStep === "processing" || flowStep === "done";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, flowStep]);

  useEffect(() => {
    if (
      flowStep === "processing" &&
      status === "ready" &&
      messages.some((m) => m.role === "assistant")
    ) {
      setFlowStep("done");
    }
  }, [status, flowStep, messages]);

  function handleConfirmReturn() {
    if (!selectedOrder || !customer) return;
    const item = selectedOrder.items[0];
    setFlowStep("processing");
    sendMessage({
      parts: [
        {
          type: "text",
          text: `Process a return request for customer ${customer.customerId} (${customer.name}) on order ${selectedOrder.orderId}. Item: ${item.name} ($${item.price}, category: ${item.category}). Order delivered: ${selectedOrder.deliveryDate}. Run the full review pipeline: look up the order, retrieve customer history, check return eligibility, assess fraud risk, then process a resolution with the customer-facing message.`,
        },
      ],
    });
  }

  function handleFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = followUpText.trim();
    if (!text || isBusy) return;
    sendMessage({ parts: [{ type: "text", text }] });
    setFollowUpText("");
  }

  function handleEndChat() {
    setCustomerId(null);
    setFlowStep("welcome");
    setSelectedOrderId(null);
  }

  if (!customer) {
    return <LoginScreen onLogin={setCustomerId} />;
  }

  const firstName = customer.name.split(" ")[0];

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            className="inline-block h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#5c2d91]"
            aria-hidden
          />
          <span>Wayfair may retain this conversation.</span>
        </div>
        <button
          onClick={handleEndChat}
          className="text-sm font-medium text-[#5c2d91] hover:underline"
        >
          End Chat
        </button>
      </header>

      {/* ── Body: chat + optional demo panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Customer chat ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

            <VaBubble>
              Hi {firstName}! I&apos;m your Wayfair virtual assistant. I can
              help you start a return or answer questions about your orders.
            </VaBubble>

            {flowStep === "welcome" && (
              <VaBubble>
                <p className="mb-3">What would you like help with today?</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFlowStep("selecting")}
                    className="rounded-full border border-[#5c2d91] px-4 py-1.5 text-sm text-[#5c2d91] transition-colors hover:bg-purple-50"
                  >
                    Request a Return
                  </button>
                  <button className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-400">
                    Track an Order
                  </button>
                  <button className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-400">
                    Other
                  </button>
                </div>
              </VaBubble>
            )}

            {flowStep !== "welcome" && (
              <UserBubble text="I want to return an item" />
            )}

            {(flowStep === "selecting" || flowStep === "confirming") && (
              <VaBubble>
                <p className="mb-3">
                  I found {customerOrders.length} order
                  {customerOrders.length !== 1 ? "s" : ""} on your account.
                  Which item would you like to return?
                </p>
                <div className="space-y-2">
                  {customerOrders.map((order) => (
                    <OrderCard
                      key={order.orderId}
                      order={order}
                      onClick={() => {
                        setSelectedOrderId(order.orderId);
                        setFlowStep("confirming");
                      }}
                    />
                  ))}
                </div>
              </VaBubble>
            )}

            {flowStep === "confirming" && selectedOrder && (
              <>
                <UserBubble
                  text={`${selectedOrder.items[0].name} — ${selectedOrder.orderId}`}
                />
                <VaBubble>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="font-medium text-gray-900">
                      {selectedOrder.items[0].name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Order {selectedOrder.orderId} · $
                      {selectedOrder.items[0].price} · Delivered{" "}
                      {selectedOrder.deliveryDate}
                    </p>
                    <p className="mt-3 text-gray-700">
                      Would you like to submit a return request for this item?
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleConfirmReturn}
                        className="rounded-full bg-[#5c2d91] px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#4a2474]"
                      >
                        Confirm Return Request
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrderId(null);
                          setFlowStep("selecting");
                        }}
                        className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-400"
                      >
                        Choose Different Item
                      </button>
                    </div>
                  </div>
                </VaBubble>
              </>
            )}

            {showPanel && (
              <>
                <UserBubble text="Yes, please submit my return request." />

                {/* Typing indicator while no assistant message yet */}
                {isBusy && !messages.some((m) => m.role === "assistant") && (
                  <VaBubble>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                    </div>
                  </VaBubble>
                )}

                {/* Agent messages — skip first user message (it's the internal prompt) */}
                {messages.map((message, idx) => {
                  if (message.role === "user" && idx === 0) return null;

                  if (message.role === "assistant") {
                    const textParts = message.parts.filter(
                      (p) => p.type === "text"
                    );
                    if (textParts.length === 0) return null;
                    return (
                      <VaBubble key={message.id}>
                        {textParts.map((p, i) =>
                          p.type === "text" ? (
                            <p
                              key={i}
                              className="whitespace-pre-wrap text-sm leading-relaxed"
                            >
                              {p.text}
                            </p>
                          ) : null
                        )}
                      </VaBubble>
                    );
                  }

                  if (message.role === "user") {
                    const tp = message.parts.find((p) => p.type === "text");
                    return tp && tp.type === "text" ? (
                      <UserBubble key={message.id} text={tp.text} />
                    ) : null;
                  }

                  return null;
                })}

                {isBusy && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => stop()}
                      className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="shrink-0 border-t border-gray-200 bg-white">
            {flowStep === "done" ? (
              <form
                onSubmit={handleFollowUp}
                className="flex items-center gap-3 px-4 py-3"
              >
                <input
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder="Send a Message"
                  disabled={isBusy}
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  disabled={!followUpText.trim() || isBusy}
                  className="text-sm font-medium text-[#5c2d91] disabled:text-gray-300 hover:underline"
                >
                  Send
                </button>
              </form>
            ) : (
              <p className="px-4 py-3 text-sm italic text-gray-400">
                {flowStep === "processing"
                  ? "Reviewing your request…"
                  : "Please select an option above to continue."}
              </p>
            )}
          </div>
        </div>

        {/* ── Demo analysis panel ── */}
        {showPanel && (
          <DemoPanel
            toolActivity={toolActivity}
            policy={policy}
            fraud={fraud}
            resolution={resolution}
            isBusy={isBusy}
          />
        )}
      </div>
    </div>
  );
}
