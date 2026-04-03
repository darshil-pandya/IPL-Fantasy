import type {
  AuctionState,
  Franchise,
  LeagueBundle,
  LeagueMeta,
  LeagueRules,
  Player,
} from "../types";
import { buildStandings, playerMapFromList } from "./buildStandings";

async function fetchJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL;
  const url = `${base}${path.replace(/^\//, "")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadLeagueBundle(): Promise<LeagueBundle> {
  const [meta, franchiseFile, playerFile, auction, rules] = await Promise.all([
    fetchJson<LeagueMeta>("data/meta.json"),
    fetchJson<{ franchises: Franchise[] }>("data/franchises.json"),
    fetchJson<{ players: Player[] }>("data/players.json"),
    fetchJson<AuctionState>("data/auction.json"),
    fetchJson<LeagueRules>("data/rules.json"),
  ]);

  return {
    meta,
    franchises: franchiseFile.franchises,
    players: playerFile.players,
    auction,
    rules,
  };
}

export function summarizeBundle(bundle: LeagueBundle) {
  const standings = buildStandings(bundle.franchises, bundle.players);
  const sorted = [...standings].sort((a, b) => b.totalPoints - a.totalPoints);
  const pmap = playerMapFromList(bundle.players);
  return { standings, sorted, pmap };
}
