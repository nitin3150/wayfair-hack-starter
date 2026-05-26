"use client";

import { useState, useCallback } from "react";
import ClaimCard from "./claim-card";
import ThresholdSlider from "./threshold-slider";
import type { ScoringResult } from "@/lib/fraud/types";

const COLUMNS = [
  { key: "AUTO_APPROVE" as const, label: "✅ Auto-Approve", borderClass: "border-green-800", headerClass: "text-green-400 border-green-800" },
  { key: "HUMAN_REVIEW" as const, label: "🔍 Human Review", borderClass: "border-yellow-800", headerClass: "text-yellow-400 border-yellow-800" },
  { key: "AUTO_DENY" as const, label: "🚫 Auto-Deny", borderClass: "border-red-800", headerClass: "text-red-400 border-red-800" },
];

function ThresholdBand({ approve, deny }: { approve: number; deny: number }) {
  return (
    <div className="relative h-3 rounded-full overflow-hidden bg-gray-700 w-full max-w-md">
      <div className="absolute left-0 top-0 h-full bg-green-600" style={{ width: `${approve}%` }} />
      <div
        className="absolute top-0 h-full bg-yellow-500"
        style={{ left: `${approve}%`, width: `${deny - approve}%` }}
      />
      <div className="absolute top-0 right-0 h-full bg-red-600" style={{ width: `${100 - deny}%` }} />
    </div>
  );
}

export default function FraudDashboard() {
  const [approveThreshold, setApproveThreshold] = useState(40);
  const [denyThreshold, setDenyThreshold] = useState(70);
  const [results, setResults] = useState<ScoringResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classify = useCallback(
    (score: number) => {
      if (score < approveThreshold) return "AUTO_APPROVE";
      if (score > denyThreshold) return "AUTO_DENY";
      return "HUMAN_REVIEW";
    },
    [approveThreshold, denyThreshold]
  );

  const runDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnimated(false);

    try {
      const claimsRes = await fetch("/api/fraud/demo-claims");
      if (!claimsRes.ok) throw new Error("Failed to fetch demo claims");
      const claims = await claimsRes.json();

      const batchRes = await fetch("/api/fraud/score-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claims,
          approve_threshold: approveThreshold,
          deny_threshold: denyThreshold,
        }),
      });
      if (!batchRes.ok) throw new Error("Scoring failed");

      const scored: ScoringResult[] = await batchRes.json();
      setResults(scored);
      setAnimated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [approveThreshold, denyThreshold]);

  const handleApproveChange = useCallback(
    (val: number) => {
      setApproveThreshold(Math.min(val, denyThreshold - 5));
    },
    [denyThreshold]
  );

  const handleDenyChange = useCallback(
    (val: number) => {
      setDenyThreshold(Math.max(val, approveThreshold + 5));
    },
    [approveThreshold]
  );

  // Re-classify results when thresholds change
  const displayedResults = results.map((r) => ({
    ...r,
    decision: classify(r.final_score),
  })) as ScoringResult[];

  const columns = COLUMNS.map((col) => ({
    ...col,
    cards: displayedResults.filter((r) => r.decision === col.key),
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Chat</a>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Wayfair Refund Fraud Detection
          </h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">AI-powered risk scoring for refund claims</p>

        <div className="flex flex-wrap items-end gap-8">
          <ThresholdSlider
            label="Approve Threshold"
            value={approveThreshold}
            min={10}
            max={60}
            onChange={handleApproveChange}
            color="green"
          />
          <ThresholdSlider
            label="Deny Threshold"
            value={denyThreshold}
            min={50}
            max={95}
            onChange={handleDenyChange}
            color="red"
          />
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <div className="text-xs text-gray-400 flex justify-between">
              <span className="text-green-400">GREEN ≤{approveThreshold}</span>
              <span className="text-yellow-400">{approveThreshold}–{denyThreshold}</span>
              <span className="text-red-400">≥{denyThreshold} RED</span>
            </div>
            <ThresholdBand approve={approveThreshold} deny={denyThreshold} />
          </div>

          <button
            onClick={runDemo}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            {loading ? "⏳ Scoring..." : "▶ Run Demo Claims"}
          </button>
        </div>

        {error && (
          <div className="mt-3 px-4 py-2 rounded bg-red-900 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key} className={`rounded-xl border-2 bg-gray-900 p-4 ${col.borderClass}`}>
            <h2 className={`font-bold text-base mb-4 pb-2 border-b ${col.headerClass}`}>
              {col.label}
              <span className="ml-2 text-xs font-normal text-gray-500">({col.cards.length})</span>
            </h2>

            {loading && results.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <ClaimCard key={i} isLoading />
                ))}
              </div>
            ) : col.cards.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-8">No claims</div>
            ) : (
              <div className="space-y-3">
                {col.cards.map((r) => (
                  <ClaimCard key={r.claim.claim_id} result={r} animated={animated} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
