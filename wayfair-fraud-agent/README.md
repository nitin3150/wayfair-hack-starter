# Wayfair Refund Fraud Detection Agent

AI-powered risk scoring for refund claims. Rule engine + Claude LLM adjuster + real-time threshold dashboard.

## Setup

### 1. API Key

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=<your key>
```

### 2. Backend

```bash
pip install -r requirements.txt
cd backend
uvicorn main:app --reload
# Runs at http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install && npm run dev
# Runs at http://localhost:5173
```

## Demo Flow

1. Open http://localhost:5173
2. Click **▶ Run Demo Claims**
3. Watch 3 claims score and slide into columns
4. Drag the **Approve** / **Deny** threshold sliders to re-classify in real time

## Scoring Logic

| Category | Max | Driver |
|---|---|---|
| Refund History | 30 | Refund count in 90 days |
| Delivery | 25 | GPS/proxy/no-scan status |
| LTV/History | 20 | Customer lifetime value + account age |
| Photo | 15 | Photo match quality |
| Payment | 10 | Prior chargebacks |

Scores 30–80: Claude LLM adjuster applies ±15 based on claim text analysis.

## Architecture

```
frontend (Vite/React) → POST /score-batch → FastAPI → scorer.py + Claude API
                      ← ScoringResult[]
```

## Demo Claims

| Claim | Target |
|---|---|
| CLM-001 Sarah Mitchell | AUTO_APPROVE (score ~0) |
| CLM-002 Marcus Webb | HUMAN_REVIEW (score ~56) |
| CLM-003 Account_9821 | AUTO_DENY (score ~91) |
