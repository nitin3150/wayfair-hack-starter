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
  lookupOrder: "Looking up order details",
  getCustomerHistory: "Reviewing account history",
  checkReturnEligibility: "Checking return eligibility",
  assessFraudRisk: "Analyzing return patterns",
  processResolution: "Processing resolution",
};

type FlowStep =
  | "welcome"
  | "selecting"
  | "confirming"
  | "processing"
  | "done";

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

function OrderCard({
  order,
  onClick,
}: {
  order: Order;
  onClick: () => void;
}) {
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

// ─── VA bubble / user bubble ──────────────────────────────────────────────────

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

// ─── Tool progress row ────────────────────────────────────────────────────────

function ToolRow({
  part,
  id,
  index,
}: {
  part: UIMessage["parts"][number];
  id: string;
  index: number;
}) {
  if (!part.type.startsWith("tool-")) return null;
  const toolName = part.type.replace("tool-", "");
  const state = "state" in part ? (part.state as string) : "";
  const label = TOOL_LABELS[toolName] ?? toolName;
  const done = state === "output-available";
  const errored = state === "output-error";

  return (
    <div
      key={`${id}-tool-${index}`}
      className="flex items-center gap-2 py-0.5 text-xs text-gray-500"
    >
      {errored ? (
        <span className="text-red-400">✗</span>
      ) : done ? (
        <span className="text-[#5c2d91]">✓</span>
      ) : (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#5c2d91] border-t-transparent" />
      )}
      <span>
        {label}
        {!done && !errored ? "…" : ""}
      </span>
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, flowStep]);

  // Transition from processing → done once agent finishes
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

  function handleFollowUp(e: React.FormEvent) {
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
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {/* small triangle matching the Wayfair UI */}
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

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* Welcome */}
        <VaBubble>
          Hi {firstName}! I&apos;m your Wayfair virtual assistant. I can help
          you start a return or answer questions about your orders.
        </VaBubble>

        {/* Quick actions (welcome only) */}
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

        {/* User triggered return flow */}
        {flowStep !== "welcome" && (
          <UserBubble text="I want to return an item" />
        )}

        {/* Order list */}
        {(flowStep === "selecting" || flowStep === "confirming") && (
          <VaBubble>
            <p className="mb-3">
              I found {customerOrders.length} order
              {customerOrders.length !== 1 ? "s" : ""} on your account. Which
              item would you like to return?
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

        {/* Selected order + confirm / cancel */}
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

        {/* Processing + done: agent conversation */}
        {(flowStep === "processing" || flowStep === "done") && (
          <>
            <UserBubble text="Yes, please submit my return request." />

            {/* Agent messages — skip index 0 (the hidden system prompt) */}
            {messages.map((message, msgIndex) => {
              if (message.role === "user" && msgIndex === 0) return null;

              if (message.role === "assistant") {
                return (
                  <VaBubble key={message.id}>
                    <div className="space-y-1">
                      {message.parts.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <p
                              key={i}
                              className="whitespace-pre-wrap text-sm leading-relaxed"
                            >
                              {part.text}
                            </p>
                          );
                        }
                        if (part.type.startsWith("tool-")) {
                          return (
                            <ToolRow
                              key={i}
                              part={part}
                              id={message.id}
                              index={i}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  </VaBubble>
                );
              }

              if (message.role === "user") {
                const textPart = message.parts.find((p) => p.type === "text");
                return textPart && textPart.type === "text" ? (
                  <UserBubble key={message.id} text={textPart.text} />
                ) : null;
              }

              return null;
            })}

            {/* Typing indicator */}
            {isBusy && !messages.some((m) => m.role === "assistant") && (
              <VaBubble>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </div>
              </VaBubble>
            )}

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
      <div className="border-t border-gray-200 bg-white">
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
  );
}
