import { useState, useCallback } from 'react'
import ClaimCard from './ClaimCard'
import ThresholdSlider from './ThresholdSlider'

const API = 'http://localhost:8000'

const COLUMNS = [
  { key: 'AUTO_APPROVE', label: '✅ Auto-Approve', headerClass: 'text-green-400 border-green-800' },
  { key: 'HUMAN_REVIEW', label: '🔍 Human Review', headerClass: 'text-yellow-400 border-yellow-800' },
  { key: 'AUTO_DENY', label: '🚫 Auto-Deny', headerClass: 'text-red-400 border-red-800' },
]

function ThresholdBand({ approve, deny }) {
  const approveLeft = ((approve - 0) / 100) * 100
  const denyLeft = ((deny - 0) / 100) * 100

  return (
    <div className="relative h-3 rounded-full overflow-hidden bg-gray-700 w-full max-w-md">
      <div className="absolute left-0 top-0 h-full bg-green-600" style={{ width: `${approveLeft}%` }} />
      <div className="absolute top-0 h-full bg-yellow-500" style={{ left: `${approveLeft}%`, width: `${denyLeft - approveLeft}%` }} />
      <div className="absolute top-0 right-0 h-full bg-red-600" style={{ width: `${100 - denyLeft}%` }} />
    </div>
  )
}

export default function App() {
  const [approveThreshold, setApproveThreshold] = useState(40)
  const [denyThreshold, setDenyThreshold] = useState(70)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [animated, setAnimated] = useState(false)
  const [error, setError] = useState(null)

  const classify = (finalScore) => {
    if (finalScore < approveThreshold) return 'AUTO_APPROVE'
    if (finalScore > denyThreshold) return 'AUTO_DENY'
    return 'HUMAN_REVIEW'
  }

  const runDemo = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnimated(false)

    try {
      const claimsRes = await fetch(`${API}/demo-claims`)
      if (!claimsRes.ok) throw new Error('Failed to fetch demo claims')
      const claims = await claimsRes.json()

      const batchRes = await fetch(`${API}/score-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claims,
          approve_threshold: approveThreshold,
          deny_threshold: denyThreshold,
        }),
      })
      if (!batchRes.ok) throw new Error('Scoring failed')
      const scored = await batchRes.json()
      setResults(scored)
      setAnimated(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [approveThreshold, denyThreshold])

  const handleApproveChange = useCallback(
    (val) => {
      const clamped = Math.min(val, denyThreshold - 5)
      setApproveThreshold(clamped)
      if (results.length > 0) {
        setResults((prev) =>
          prev.map((r) => ({ ...r, decision: classify(r.final_score) }))
        )
      }
    },
    [denyThreshold, results]
  )

  const handleDenyChange = useCallback(
    (val) => {
      const clamped = Math.max(val, approveThreshold + 5)
      setDenyThreshold(clamped)
      if (results.length > 0) {
        setResults((prev) =>
          prev.map((r) => ({ ...r, decision: classify(r.final_score) }))
        )
      }
    },
    [approveThreshold, results]
  )

  const effectiveApprove = approveThreshold
  const effectiveDeny = denyThreshold

  const columns = COLUMNS.map((col) => ({
    ...col,
    cards: results.filter((r) => {
      const score = r.final_score
      if (col.key === 'AUTO_APPROVE') return score < effectiveApprove
      if (col.key === 'AUTO_DENY') return score > effectiveDeny
      return score >= effectiveApprove && score <= effectiveDeny
    }),
  }))

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white mb-1">
          Wayfair Refund Fraud Detection
        </h1>
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
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors whitespace-nowrap"
          >
            {loading ? '⏳ Scoring...' : '▶ Run Demo Claims'}
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
          <div key={col.key} className={`rounded-xl border bg-gray-900 p-4 border-2 ${col.headerClass}`}>
            <h2 className={`font-bold text-base mb-4 pb-2 border-b ${col.headerClass}`}>
              {col.label}
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({col.cards.length})
              </span>
            </h2>

            {loading && results.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <ClaimCard key={i} isLoading={true} />
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
  )
}
