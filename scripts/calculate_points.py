"""
calculate_points.py — Apply IPL Fantasy scoring rules to a parsed scorecard.
Rules sourced from public/IPL-Fantasy/data/rules.json
"""

def calculate_batting_points(player):
    """
    player: {runs, balls, fours, sixes, duck}
    Returns: int (fantasy points from batting)
    """
    pts = 0
    runs = player.get("runs", 0)
    balls = player.get("balls", 0)
    fours = player.get("fours", 0)
    sixes = player.get("sixes", 0)
    duck = player.get("duck", False)

    # Base runs
    pts += runs

    # Boundaries
    pts += fours * 2
    pts += sixes * 4

    # Milestone bonuses (stacking: only highest applies per rule)
    if runs >= 100:
        pts += 16
    elif runs >= 75:
        pts += 12
    elif runs >= 50:
        pts += 8
    elif runs >= 25:
        pts += 4

    # Duck penalty (BAT, WK, AR only — not pure bowlers)
    if duck:
        pts -= 2

    # Strike rate bonus/penalty (min 10 balls)
    if balls >= 10:
        sr = (runs / balls) * 100
        if sr > 170:
            pts += 6
        elif sr > 150:
            pts += 4
        elif sr >= 130:
            pts += 2
        elif 60 <= sr <= 70:
            pts -= 2
        elif 50 <= sr < 60:
            pts -= 4
        elif sr < 50:
            pts -= 6

    return pts


def calculate_bowling_points(player):
    """
    player: {overs (decimal), runs, wickets, maidens, dots}
    Returns: int (fantasy points from bowling)
    """
    pts = 0
    overs = player.get("overs", 0)
    runs = player.get("runs", 0)
    wickets = player.get("wickets", 0)
    maidens = player.get("maidens", 0)
    dots = player.get("dots", 0)

    # Dot balls
    pts += dots

    # Wickets
    pts += wickets * 25

    # Wicket haul bonuses
    if wickets >= 5:
        pts += 16
    elif wickets >= 4:
        pts += 8
    elif wickets >= 3:
        pts += 4

    # Maiden overs
    pts += maidens * 12

    # Economy rate (min 2 overs)
    if overs >= 2 and overs > 0:
        economy = runs / overs
        if economy < 5:
            pts += 6
        elif economy <= 5.99:
            pts += 4
        elif economy <= 7:
            pts += 2
        elif 10 <= economy <= 11:
            pts -= 2
        elif 11.01 <= economy <= 12:
            pts -= 4
        elif economy > 12:
            pts -= 6

    return pts


def calculate_fielding_points(player):
    """
    player: {catches, stumpings, runout_direct, runout_indirect}
    Returns: int (fantasy points from fielding)
    """
    pts = 0
    catches = player.get("catches", 0)
    stumpings = player.get("stumpings", 0)
    runout_direct = player.get("runout_direct", 0)
    runout_indirect = player.get("runout_indirect", 0)

    pts += catches * 8
    pts += stumpings * 12
    pts += runout_direct * 12
    pts += runout_indirect * 6

    # 3-catch bonus (once only, regardless of how many catches)
    if catches >= 3:
        pts += 4

    return pts


def calculate_appearance_points(named_in_xi=True, is_impact_player=False):
    """Named in XI: +4. Impact player sub: +4."""
    pts = 0
    if named_in_xi:
        pts += 4
    if is_impact_player:
        pts += 4
    return pts


def calculate_player_total(batting=None, bowling=None, fielding=None, named_in_xi=True):
    """
    Calculate total fantasy points for a player in one match.
    Each arg is a dict with the relevant stats or None.
    """
    total = calculate_appearance_points(named_in_xi)
    if batting:
        total += calculate_batting_points(batting)
    if bowling:
        total += calculate_bowling_points(bowling)
    if fielding:
        total += calculate_fielding_points(fielding)
    return total


if __name__ == "__main__":
    # Test example: Rohit Sharma — 45 runs, 30 balls, 3 fours, 2 sixes, not out
    bat = {"runs": 45, "balls": 30, "fours": 3, "sixes": 2, "duck": False}
    print("Rohit batting pts:", calculate_batting_points(bat))

    # Bumrah — 4 overs, 20 runs, 3 wickets, 0 maidens, 8 dots
    bowl = {"overs": 4, "runs": 20, "wickets": 3, "maidens": 0, "dots": 8}
    print("Bumrah bowling pts:", calculate_bowling_points(bowl))

    # Fielding — 2 catches
    field = {"catches": 2, "stumpings": 0, "runout_direct": 0, "runout_indirect": 0}
    print("Fielding pts:", calculate_fielding_points(field))

    total = calculate_player_total(bat, bowl, field, named_in_xi=True)
    print("Total:", total)
