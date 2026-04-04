# IPL Fantasy — Live Score Integration

## Overview

This branch (`mihawk_yv`) adds **automated live score fetching and fantasy point calculation** using free cricket APIs — no paid subscription required.

## Setup

### 1. Get a Free API Key (2 minutes)

Sign up at **[cricapi.com](https://cricapi.com)** → free tier gives **100,000 requests/hour**.

### 2. Add to GitHub Secrets

In your fork: **Settings → Secrets → Actions → New repository secret**
- Name: `CRICAPI_KEY`
- Value: your key from cricapi.com

### 3. Enable GitHub Actions

Already configured in `.github/workflows/auto-update-points.yml`

Runs automatically every 30 minutes during IPL match hours (7:30 PM – 1:30 AM IST).

---

## How It Works

```
CricAPI (free, 100k req/hr)
        │
        ▼
scripts/fetch_scores.py     ← fetches live scorecard
        │
        ▼
scripts/calculate_points.py ← applies your rules.json scoring
        │
        ▼
scripts/update_points.py    ← updates players.json + meta.json
        │
        ▼
git commit → GitHub Pages redeploys → everyone sees updated standings
```

---

## Manual Run

```bash
# Install dependency
pip install requests

# Dry run (preview without saving)
CRICAPI_KEY=your_key python scripts/update_points.py --dry-run

# Process all recent matches
CRICAPI_KEY=your_key python scripts/update_points.py

# Process a specific match
CRICAPI_KEY=your_key python scripts/update_points.py --match-id MATCH_ID_HERE

# Force reprocess an already-processed match
CRICAPI_KEY=your_key python scripts/update_points.py --match-id ID --force
```

---

## Files Added

| File | Purpose |
|---|---|
| `scripts/fetch_scores.py` | Fetches live/recent scorecards from CricAPI |
| `scripts/calculate_points.py` | Converts scorecard stats → fantasy points per `rules.json` |
| `scripts/update_points.py` | Orchestrates fetch → calculate → write to JSON |
| `.github/workflows/auto-update-points.yml` | Scheduled GitHub Actions workflow |

---

## Points Calculation

Reads scoring rules directly from `public/IPL-Fantasy/data/rules.json`:

- **Batting:** Runs, boundaries (+2/+4), milestones (25/50/75/100 bonuses), duck penalty, strike rate
- **Bowling:** Dot balls, wickets (+25 each), haul bonuses, maiden overs (+12), economy rate
- **Fielding:** Catches (+8), stumpings (+12), run outs (+6/+12), 3-catch bonus
- **Appearance:** Named in XI (+4), Impact Player (+4)

---

## Duplicate Prevention

Processed match IDs are tracked in `public/IPL-Fantasy/data/.processed_matches.json`. Each match is only processed once unless you use `--force`.

---

## Fallback

If `CRICAPI_KEY` is not set, the scripts will output a warning but not crash. Points update manually as before.
