"""
scorecard_query.py — CLI tool to query IPL match scorecards from last 48 hours.

Usage:
  python scripts/scorecard_query.py
  python scripts/scorecard_query.py --match "CSK vs MI"
  python scripts/scorecard_query.py --list
  CRICAPI_KEY=your_key python scripts/scorecard_query.py

No API key needed for listing matches (basic data).
CRICAPI_KEY required for full scorecard details.
"""
import os
import sys
import json
import argparse
import requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_scores import HEADERS
from calculate_points import (
    calculate_batting_points, calculate_bowling_points,
    calculate_fielding_points, calculate_appearance_points
)

CRICAPI_KEY = os.getenv("CRICAPI_KEY", "")
IPL_2026_SERIES_ID_ESPN = "1510719"


def get_recent_matches_48h():
    """
    Fetch all IPL matches from the last 48 hours.
    Returns list of {match_id, name, date, status, teams, result}
    """
    matches = []

    # Try CricAPI first
    if CRICAPI_KEY:
        try:
            r = requests.get(
                f"https://api.cricapi.com/v1/currentMatches?apikey={CRICAPI_KEY}&offset=0",
                headers=HEADERS, timeout=10
            )
            data = r.json()
            if data.get("status") == "success":
                for m in data.get("data", []):
                    if "IPL" not in m.get("name", "") and "Indian Premier" not in m.get("series", ""):
                        continue
                    matches.append({
                        "match_id": m.get("id", ""),
                        "name": m.get("name", ""),
                        "date": m.get("date", ""),
                        "status": m.get("status", ""),
                        "teams": [t.get("name", "") for t in m.get("teams", [])],
                        "result": m.get("status", ""),
                        "source": "cricapi"
                    })
        except Exception as e:
            print(f"[query] CricAPI fetch failed: {e}")

    # Also try series match list (no key needed for basic listing)
    try:
        url = f"https://api.cricapi.com/v1/series_info?apikey={CRICAPI_KEY}&id={IPL_2026_SERIES_ID_ESPN}"
        if CRICAPI_KEY:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                data = r.json()
                for m in data.get("data", {}).get("matchList", []):
                    mid = m.get("id", "")
                    if mid and not any(x["match_id"] == mid for x in matches):
                        matches.append({
                            "match_id": mid,
                            "name": m.get("name", ""),
                            "date": m.get("date", ""),
                            "status": m.get("matchType", ""),
                            "teams": [],
                            "result": "",
                            "source": "cricapi_series"
                        })
    except Exception:
        pass

    # Filter to last 48 hours if date info available
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)
    filtered = []
    for m in matches:
        date_str = m.get("date", "")
        if date_str:
            try:
                # CricAPI returns dates like "2026-04-04"
                match_date = datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if match_date >= cutoff:
                    filtered.append(m)
            except:
                filtered.append(m)  # Include if can't parse date
        else:
            filtered.append(m)

    return filtered


def fetch_full_scorecard(match_id):
    """Fetch and parse full scorecard for a match."""
    if not CRICAPI_KEY:
        return None, "CRICAPI_KEY not set. Get a free key at cricapi.com"
    try:
        r = requests.get(
            f"https://api.cricapi.com/v1/match_scorecard?apikey={CRICAPI_KEY}&id={match_id}",
            headers=HEADERS, timeout=10
        )
        data = r.json()
        if data.get("status") != "success":
            return None, data.get("reason", "Failed to fetch scorecard")
        return data.get("data"), None
    except Exception as e:
        return None, str(e)


def format_scorecard(scorecard, match_name=""):
    """Format scorecard data into a readable text output."""
    lines = []
    lines.append("=" * 60)
    lines.append(f"  {match_name or scorecard.get('name', 'IPL Match')}")
    lines.append(f"  {scorecard.get('status', '')}")
    lines.append("=" * 60)

    innings_list = scorecard.get("scorecard", []) or scorecard.get("innings", []) or []

    for idx, innings in enumerate(innings_list):
        team = innings.get("inningsTeamName", "") or innings.get("team", f"Innings {idx+1}")
        total_runs = innings.get("r", "") or innings.get("runs", "")
        total_wkts = innings.get("w", "") or innings.get("wickets", "")
        total_ovs = innings.get("o", "") or innings.get("overs", "")
        extras = innings.get("extras", "")

        lines.append(f"\n🏏 {team}  {total_runs}/{total_wkts} ({total_ovs} ov)")
        if extras:
            lines.append(f"   Extras: {extras}")

        # Batting
        batsmen = innings.get("batting", []) or innings.get("inningsBatsmen", [])
        if batsmen:
            lines.append("\n  Batting")
            lines.append(f"  {'Player':<22} {'R':>4} {'B':>4} {'4s':>3} {'6s':>3} {'SR':>6}  Dismissal")
            lines.append("  " + "-" * 58)
            for b in batsmen:
                name = b.get("batsman", {}).get("name", "") or b.get("name", "")
                runs = b.get("r", "-") or "-"
                balls = b.get("b", "-") or "-"
                fours = b.get("4s", 0) or 0
                sixes = b.get("6s", 0) or 0
                sr = b.get("sr", "-") or "-"
                dismissal = b.get("dismissal", "not out") or "not out"
                if name:
                    # Calculate fantasy points
                    pts = calculate_batting_points({
                        "runs": int(runs) if str(runs).isdigit() else 0,
                        "balls": int(balls) if str(balls).isdigit() else 0,
                        "fours": int(fours), "sixes": int(sixes),
                        "duck": dismissal != "not out" and str(runs) == "0"
                    })
                    lines.append(f"  {name:<22} {str(runs):>4} {str(balls):>4} {str(fours):>3} {str(sixes):>3} {str(sr):>6}  {dismissal[:25]:<25}  [{pts:+d}pts]")

        # Bowling
        bowlers = innings.get("bowling", []) or innings.get("inningsBowlers", [])
        if bowlers:
            lines.append("\n  Bowling")
            lines.append(f"  {'Bowler':<22} {'O':>5} {'M':>3} {'R':>4} {'W':>3} {'Econ':>6}")
            lines.append("  " + "-" * 46)
            for b in bowlers:
                name = b.get("bowler", {}).get("name", "") or b.get("name", "")
                overs = b.get("o", "-") or "-"
                maidens = b.get("m", 0) or 0
                runs_c = b.get("r", "-") or "-"
                wickets = b.get("w", 0) or 0
                economy = b.get("eco", "-") or "-"
                if name:
                    try:
                        parts = str(overs).split(".")
                        ovs_dec = int(parts[0]) + (int(parts[1]) if len(parts) > 1 else 0) / 6
                    except:
                        ovs_dec = 0
                    pts = calculate_bowling_points({
                        "overs": ovs_dec, "runs": int(runs_c) if str(runs_c).isdigit() else 0,
                        "wickets": int(wickets), "maidens": int(maidens), "dots": 0
                    })
                    lines.append(f"  {name:<22} {str(overs):>5} {str(maidens):>3} {str(runs_c):>4} {str(wickets):>3} {str(economy):>6}  [{pts:+d}pts]")

    lines.append("\n" + "=" * 60)
    lines.append(f"  * Fantasy points shown are estimates based on rules.json")
    lines.append("=" * 60)
    return "\n".join(lines)


def search_match(query, matches):
    """Find a match from the list by team name or partial match name."""
    q = query.lower()
    # Exact match first
    for m in matches:
        if q in m["name"].lower():
            return m
    # Team abbreviation match
    abbrevs = {
        "csk": "chennai", "mi": "mumbai", "rcb": "bangalore", "kkr": "kolkata",
        "dc": "delhi", "srh": "hyderabad", "pbks": "punjab", "rr": "rajasthan",
        "lsg": "lucknow", "gt": "gujarat"
    }
    for abbr, full in abbrevs.items():
        if abbr in q:
            for m in matches:
                if full in m["name"].lower():
                    return m
    return None


def main():
    parser = argparse.ArgumentParser(description="IPL Fantasy Scorecard Query")
    parser.add_argument("--match", "-m", type=str, help="Match query (e.g. 'CSK vs MI', 'RCB', 'match 5')")
    parser.add_argument("--list", "-l", action="store_true", help="List all recent matches (last 48h)")
    parser.add_argument("--match-id", type=str, help="Fetch scorecard by exact match ID")
    args = parser.parse_args()

    print("\n📊 IPL Fantasy Scorecard Query")
    print(f"   API: {'CricAPI ✅' if CRICAPI_KEY else '⚠️  No CRICAPI_KEY set (get free key at cricapi.com)'}")

    if args.match_id:
        sc, err = fetch_full_scorecard(args.match_id)
        if err:
            print(f"\n❌ Error: {err}")
        else:
            print(format_scorecard(sc))
        return

    # Fetch recent matches
    print("\n⏳ Fetching recent IPL matches (last 48h)...\n")
    matches = get_recent_matches_48h()

    if not matches:
        print("❌ No IPL matches found in last 48 hours.")
        if not CRICAPI_KEY:
            print("\n💡 Tip: Set CRICAPI_KEY env var for live data:")
            print("   export CRICAPI_KEY=your_free_key")
            print("   Get free key at: https://cricapi.com")
        return

    if args.list or not args.match:
        print(f"📋 Recent IPL Matches (last 48h) — {len(matches)} found:\n")
        for i, m in enumerate(matches, 1):
            print(f"  {i}. {m['name']}")
            print(f"     Status: {m['status']}")
            print(f"     Date: {m['date']}")
            print(f"     ID: {m['match_id']}\n")

        if not args.match:
            # Interactive mode
            try:
                choice = input("\nEnter match number or search term (or 'q' to quit): ").strip()
                if choice.lower() == 'q':
                    return
                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(matches):
                        selected = matches[idx]
                    else:
                        print("Invalid selection."); return
                else:
                    selected = search_match(choice, matches)
                    if not selected:
                        print(f"No match found for '{choice}'"); return
            except (KeyboardInterrupt, EOFError):
                return
        else:
            selected = search_match(args.match, matches)
            if not selected:
                print(f"❌ No match found for '{args.match}'")
                print("   Use --list to see all available matches")
                return
    else:
        selected = search_match(args.match, matches)
        if not selected:
            print(f"❌ No match found for '{args.match}'")
            print("   Use --list to see all available matches")
            return

    print(f"\n⏳ Fetching full scorecard: {selected['name']}...\n")
    sc, err = fetch_full_scorecard(selected["match_id"])
    if err:
        print(f"❌ Error fetching scorecard: {err}")
        print("\n📊 Basic match info:")
        print(f"  Match: {selected['name']}")
        print(f"  Status: {selected['status']}")
        print(f"  Date: {selected['date']}")
    else:
        print(format_scorecard(sc, selected["name"]))


if __name__ == "__main__":
    main()
