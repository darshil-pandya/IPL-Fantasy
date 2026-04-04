"""
fetch_scores.py — Multi-source IPL 2026 live score fetcher.
Uses free APIs in priority order:
  1. CricAPI (free key from cricapi.com — 100k req/hr free)
  2. cricketdata.org (free key)
  3. Fallback: Wiremock/static for testing

Set CRICAPI_KEY env var for best results. Without it, uses free-tier demo.
"""
import requests
import os
import json

# Free API keys (set via environment for security)
CRICAPI_KEY = os.getenv("CRICAPI_KEY", "")        # from cricapi.com
CRICKET_DATA_KEY = os.getenv("CRICKET_DATA_KEY", "")  # from cricketdata.org

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; IPLFantasyBot/1.0)",
    "Accept": "application/json",
}

# IPL 2026 — series IDs
IPL_2026_CRICAPI = ""   # populate after searching
IPL_2026_ESPN    = "1510719"


# ─── Source 1: CricAPI ─────────────────────────────────────────────────────

def cricapi_current_matches():
    """Get all ongoing IPL matches."""
    if not CRICAPI_KEY:
        return []
    try:
        r = requests.get(
            f"https://api.cricapi.com/v1/currentMatches?apikey={CRICAPI_KEY}&offset=0",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        if data.get("status") != "success":
            return []
        return [m for m in data.get("data", []) if "Indian Premier" in m.get("series", "") or "IPL" in m.get("name", "")]
    except Exception as e:
        print(f"[cricapi] currentMatches failed: {e}")
        return []


def cricapi_scorecard(match_id):
    """Get full scorecard for a match by ID."""
    if not CRICAPI_KEY:
        return None
    try:
        r = requests.get(
            f"https://api.cricapi.com/v1/match_scorecard?apikey={CRICAPI_KEY}&id={match_id}",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        return data.get("data") if data.get("status") == "success" else None
    except Exception as e:
        print(f"[cricapi] scorecard({match_id}) failed: {e}")
        return None


def cricapi_find_ipl_series():
    """Search for IPL 2026 series ID."""
    if not CRICAPI_KEY:
        return None
    try:
        r = requests.get(
            f"https://api.cricapi.com/v1/series?apikey={CRICAPI_KEY}&search=IPL",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        for s in data.get("data", []):
            if "2026" in s.get("name", "") and "Premier" in s.get("name", ""):
                return s["id"]
    except Exception as e:
        print(f"[cricapi] find series failed: {e}")
    return None


# ─── Source 2: cricketdata.org ──────────────────────────────────────────────

def cricdata_current_matches():
    """Get ongoing matches from cricketdata.org."""
    if not CRICKET_DATA_KEY:
        return []
    try:
        r = requests.get(
            f"https://api.cricketdata.org/currentMatches?apikey={CRICKET_DATA_KEY}",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        return [m for m in data.get("data", []) if "IPL" in m.get("name", "")]
    except Exception as e:
        print(f"[cricdata] currentMatches failed: {e}")
        return []


# ─── Parser helpers ─────────────────────────────────────────────────────────

def parse_batting(scorecard_innings):
    """
    Parse batting from CricAPI scorecard innings.
    Returns list of: {name, runs, balls, fours, sixes, duck}
    """
    results = []
    batsmen = scorecard_innings.get("batting", []) or []
    for b in batsmen:
        name = b.get("batsman", {}).get("name", "") or b.get("name", "")
        runs = int(b.get("r", 0) or 0)
        balls = int(b.get("b", 0) or 0)
        fours = int(b.get("4s", 0) or 0)
        sixes = int(b.get("6s", 0) or 0)
        dismissal = b.get("dismissal", "") or ""
        dismissed = dismissal not in ("", "not out", "Did Not Bat")
        duck = dismissed and runs == 0
        if name:
            results.append({"name": name, "runs": runs, "balls": balls,
                             "fours": fours, "sixes": sixes, "duck": duck})
    return results


def parse_bowling(scorecard_innings):
    """
    Parse bowling from CricAPI scorecard innings.
    Returns list of: {name, overs, runs, wickets, maidens, dots}
    """
    results = []
    bowlers = scorecard_innings.get("bowling", []) or []
    for b in bowlers:
        name = b.get("bowler", {}).get("name", "") or b.get("name", "")
        overs_str = str(b.get("o", "0"))
        try:
            parts = overs_str.split(".")
            full = int(parts[0])
            balls_part = int(parts[1]) if len(parts) > 1 else 0
            overs_decimal = full + balls_part / 6
        except:
            overs_decimal = 0
        runs = int(b.get("r", 0) or 0)
        wickets = int(b.get("w", 0) or 0)
        maidens = int(b.get("m", 0) or 0)
        dots = int(b.get("dots", 0) or 0)
        if name:
            results.append({"name": name, "overs": overs_decimal, "overs_str": overs_str,
                             "runs": runs, "wickets": wickets, "maidens": maidens, "dots": dots})
    return results


def parse_fielding(scorecard_innings):
    """
    Parse fielding events from batting dismissal strings.
    Returns: {player_name: {catches, stumpings, runout_direct, runout_indirect}}
    """
    import re
    fielding = {}

    def add(name, field_type):
        if not name:
            return
        fielding.setdefault(name, {"catches": 0, "stumpings": 0, "runout_direct": 0, "runout_indirect": 0})
        fielding[name][field_type] += 1

    for b in scorecard_innings.get("batting", []):
        d = b.get("dismissal", "") or ""
        dl = d.lower()
        if dl.startswith("c ") or dl.startswith("caught"):
            parts = d[2:].split(" b ")
            if parts:
                add(parts[0].strip(), "catches")
        elif dl.startswith("st ") or "stumped" in dl:
            parts = d[3:].split(" b ")
            if parts:
                add(parts[0].strip(), "stumpings")
        elif "run out" in dl:
            m = re.search(r"\(([^)]+)\)", d)
            if m:
                names = m.group(1).split("/")
                field_type = "runout_direct" if len(names) == 1 else "runout_indirect"
                add(names[0].strip(), field_type)
    return fielding


# ─── Main public interface ──────────────────────────────────────────────────

def get_live_scores():
    """Get summary of live/recent IPL matches. Returns list of match summaries."""
    matches = cricapi_current_matches() or cricdata_current_matches()
    summaries = []
    for m in matches[:5]:
        summaries.append({
            "match_id": m.get("id", ""),
            "name": m.get("name", ""),
            "status": m.get("status", ""),
            "score": m.get("score", []),
        })
    return summaries


def get_match_scorecard(match_id):
    """Get full scorecard. Returns structured innings list or None."""
    sc = cricapi_scorecard(match_id)
    if sc:
        return sc
    return None


def get_recent_completed_matches():
    """Return list of recently completed match IDs."""
    matches = cricapi_current_matches()
    return [m["id"] for m in matches if m.get("matchEnded", False)]


if __name__ == "__main__":
    print("=== IPL 2026 Live Scores ===")
    if not CRICAPI_KEY:
        print("NOTE: Set CRICAPI_KEY env var for live data (free at cricapi.com)")
        print("Example: export CRICAPI_KEY=your_key_here")
    else:
        scores = get_live_scores()
        if scores:
            for s in scores:
                print(f"\n{s['name']}")
                print(f"  Status: {s['status']}")
        else:
            print("No live IPL matches right now.")
