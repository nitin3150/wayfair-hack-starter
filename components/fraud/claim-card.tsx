"use client";

import type { ScoringResult } from "@/lib/fraud/types";

const SUB_SCORE_CONFIG = [
  { key: "refund_history" as const, label: "Refund History", max: 30 },
  { key: "delivery" as const, label: "Delivery", max: 25 },
  { key: "ltv_history" as const, label: "LTV/History", max: 20 },
  { key: "photo" as const, label: "Photo", max: 15 },
  { key: "payment" as const, label: "Payment", max: 10 },
];

function barColor(score: number, max: number) {
  const pct = score / max;
  if (pct > 0.6) return "bg-red-500";
  if (pct >= 0.3) return "bg-yellow-400";
  return "bg-green-500";
}

function scoreColor(score: number) {
  if (score < 40) return "text-green-400";
  if (score <= 70) return "text-yellow-400";
  return "text-red-400";
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "AUTO_APPROVE")
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900 text-green-300">AUTO-APPROVE</span>;
  if (decision === "AUTO_DENY")
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900 text-red-300">AUTO-DENY</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-900 text-yellow-300">HUMAN REVIEW</span>;
}

function actionColor(decision: string) {
  if (decision === "AUTO_APPROVE") return "text-green-400";
  if (decision === "AUTO_DENY") return "text-red-400";
  return "text-yellow-400";
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-900 text-green-300",
    medium: "bg-yellow-900 text-yellow-300",
    low: "bg-gray-700 text-gray-400",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${colors[confidence] ?? colors.low}`}>
      {confidence}
    </span>
  );
}

interface Props {
  result?: ScoringResult;
  isLoading?: boolean;
  animated?: boolean;
}

export default function ClaimCard({ result, isLoading, animated }: Props) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 animate-pulse min-h-[280px] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Scoring...</div>
      </div>
    );
  }

  if (!result) return null;

  const { claim, score_breakdown, llm_result, final_score, decision, action_text } = result;
  const subScores = score_breakdown.sub_scores;
  const showLLM = llm_result && score_breakdown.base_score >= 30 && score_breakdown.base_score <= 80;

  return (
    <div
      className={`bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3 ${
        animated ? "animate-[slideIn_0.4s_ease-out_forwards]" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-gray-500 font-mono">{claim.claim_id}</div>
          <div className="font-bold text-white text-sm">{claim.customer_name}</div>
          <div className="text-xs text-gray-400">
            ${claim.order_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-3xl font-black ${scoreColor(final_score)}`}>{final_score}</div>
          <DecisionBadge decision={decision} />
        </div>
      </div>

      {/* Score breakdown bars */}
      <div className="flex flex-col gap-1">
        {SUB_SCORE_CONFIG.map(({ key, label, max }) => {
          const val = subScores[key] ?? 0;
          const pct = Math.round((val / max) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="text-xs text-gray-500 w-24 shrink-0">{label}</div>
              <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(val, max)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 w-8 text-right">{val}</div>
            </div>
          );
        })}
      </div>

      {/* Top signals */}
      {score_breakdown.top_signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {score_breakdown.top_signals.map((sig, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-gray-700 text-xs text-gray-300">
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* LLM reasoning */}
      {showLLM && llm_result && (
        <div
          className={`bg-gray-900 rounded-lg p-3 border border-gray-600 ${
            animated ? "animate-[pulseGlow_1.5s_ease-in-out_3]" : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">🤖 AI Analysis</span>
            <ConfidenceBadge confidence={llm_result.confidence} />
            <span className="text-xs text-gray-500 ml-auto">
              {llm_result.adjustment > 0 ? "+" : ""}{llm_result.adjustment} pts
            </span>
          </div>
          <p className="text-xs text-gray-400 italic">{llm_result.reasoning}</p>
        </div>
      )}

      {/* Action */}
      <div className={`text-xs font-semibold ${actionColor(decision)} border-t border-gray-700 pt-2`}>
        {action_text}
      </div>
    </div>
  );
}
