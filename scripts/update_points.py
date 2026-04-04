"""
update_points.py — Main script to fetch latest IPL match scorecard,
calculate fantasy points, and update players.json + meta.json.

Usage:
  python scripts/update_points.py [--match-id MATCH_ID] [--dry-run]

No API key required — uses ESPN Cricinfo hidden API.
"""
import json
import os
import sys
import argparse
from datetime import datetime, timezone

# Paths
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "public", "IPL-Fantasy", "data")
PLAYERS_FILE = os.path.join(DATA_DIR, "players.json")
META_FILE = os.path.join(DATA_DIR, "meta.json")
PROCESSED_FILE = os.path.join(DATA_DIR, ".processed_matches.json")

sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from fetch_scores import (
    get_series_matches, get_match_scorecard,
    parse_batting, parse_bowling, parse_fielding
)
from calculate_points import calculate_player_total


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_processed_matches():
    if os.path.exists(PROCESSED_FILE):
        with open(PROCESSED_FILE) as f:
            return set(json.load(f))
    return set()

def mark_match_processed(match_id):
    processed = get_processed_matches()
    processed.add(str(match_id))
    with open(PROCESSED_FILE, "w") as f:
        json.dump(list(processed), f)

def normalize_player_name(name):
    """Lowercase, strip, remove extra spaces for fuzzy matching."""
    return " ".join(name.lower().strip().split())

def find_player_in_data(players, name):
    """Find a player dict by name (fuzzy match)."""
    norm = normalize_player_name(name)
    for p in players:
        if normalize_player_name(p.get("name", "")) == norm:
            return p
        # Partial match — last name
        pname = normalize_player_name(p.get("name", ""))
        if norm.split()[-1] == pname.split()[-1] and norm.split()[0][0] == pname.split()[0][0]:
            return p
    return None

def process_match(match_id, players_data, dry_run=False):
    print(f"\n[update_points] Processing match {match_id}...")
    scorecard = get_match_scorecard(match_id)
    if not scorecard:
        print(f"  Failed to fetch scorecard for {match_id}")
        return 0

    # Navigate to innings list
    content = scorecard.get("content", {}) or scorecard
    innings_list = (
        content.get("innings") or
        content.get("scorecard", {}).get("innings") or
        []
    )

    if not innings_list:
        print(f"  No innings data found for match {match_id}")
        return 0

    # Get match description for byMatch entry
    match_info = content.get("match") or content.get("matchInfo") or {}
    match_desc = match_info.get("description", "") or match_info.get("title", "") or f"Match {match_id}"
    match_date = match_info.get("startDate", "") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if match_date and len(match_date) > 10:
        match_date = match_date[:10]

    updated_count = 0
    # Track all players appearing in this match
    appearing_players = set()

    for innings in innings_list:
        batting_stats = parse_batting(innings)
        bowling_stats = parse_bowling(innings)
        fielding_stats = parse_fielding(innings)

        # Build lookup dicts
        bat_by_name = {normalize_player_name(b["name"]): b for b in batting_stats if b["name"]}
        bowl_by_name = {normalize_player_name(b["name"]): b for b in bowling_stats if b["name"]}
        field_by_name = {normalize_player_name(f): fielding_stats[f] for f in fielding_stats}

        # Collect all unique player names from this innings
        all_names = (
            set(bat_by_name.keys()) |
            set(bowl_by_name.keys()) |
            set(field_by_name.keys())
        )

        for norm_name in all_names:
            appearing_players.add(norm_name)
            player = find_player_in_data(players_data, norm_name)
            if not player:
                print(f"  [skip] {norm_name} not found in players.json")
                continue

            batting = bat_by_name.get(norm_name)
            bowling = bowl_by_name.get(norm_name)
            fielding = field_by_name.get(norm_name)

            pts = calculate_player_total(
                batting=batting,
                bowling=bowling,
                fielding=fielding,
                named_in_xi=True
            )

            if not dry_run:
                # Update seasonTotal
                player["seasonTotal"] = (player.get("seasonTotal") or 0) + pts

                # Add byMatch entry
                by_match = player.get("byMatch") or []
                by_match.append({
                    "matchId": match_id,
                    "label": match_desc,
                    "date": match_date,
                    "points": pts,
                    "breakdown": {
                        "batting": batting,
                        "bowling": bowling,
                        "fielding": fielding,
                    }
                })
                player["byMatch"] = by_match

            print(f"  {player['name']}: {pts} pts (total: {player.get('seasonTotal', 0)})")
            updated_count += 1

    print(f"  Updated {updated_count} players")
    return updated_count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--match-id", type=str, help="Process specific match ID")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--force", action="store_true", help="Re-process already processed matches")
    args = parser.parse_args()

    players_data = load_json(PLAYERS_FILE)
    meta = load_json(META_FILE)
    processed = get_processed_matches()

    if args.match_id:
        match_ids = [args.match_id]
    else:
        # Get recent completed matches
        recent = get_series_matches("recent")
        live = get_series_matches("live")
        all_matches = live + recent
        match_ids = []
        for m in all_matches:
            mid = str(m.get("id") or m.get("objectId") or "")
            if mid and (args.force or mid not in processed):
                match_ids.append(mid)

    if not match_ids:
        print("[update_points] No new matches to process.")
        return

    print(f"[update_points] Processing {len(match_ids)} match(es): {match_ids}")

    total_updated = 0
    for match_id in match_ids:
        count = process_match(match_id, players_data, dry_run=args.dry_run)
        total_updated += count
        if not args.dry_run and count > 0:
            mark_match_processed(match_id)

    if not args.dry_run and total_updated > 0:
        save_json(PLAYERS_FILE, players_data)
        # Update meta
        meta["lastPointsUpdate"] = f"Auto-updated via ESPN API — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        save_json(META_FILE, meta)
        print(f"\n[update_points] ✅ Saved. {total_updated} player entries updated.")
    elif args.dry_run:
        print(f"\n[update_points] DRY RUN complete. {total_updated} would be updated.")
    else:
        print(f"\n[update_points] No updates needed.")


if __name__ == "__main__":
    main()
