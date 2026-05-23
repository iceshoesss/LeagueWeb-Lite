const DEFAULT_SCORING_RULE = [9, 7, 6, 5, 4, 3, 2, 1]

export function calcPoints(placement: number, rule: number[] = DEFAULT_SCORING_RULE): number {
  if (placement < 1 || placement > rule.length) return 0
  return rule[placement - 1]
}

export function getScoringPositions(count: number = 8): number[] {
  return Array.from({ length: count }, (_, i) => i + 1)
}

export interface StandingsRow {
  player_id: number
  battle_tag: string
  display_name: string | null
  total_points: number
  games_played: number
  total_placements: number
  wins: number
}

export function calcStandings(
  players: { player_id: number; battle_tag: string; display_name: string | null }[],
  placements: { player_id: number; placement: number | null }[]
): StandingsRow[] {
  const map = new Map<number, StandingsRow>()

  for (const p of players) {
    map.set(p.player_id, {
      player_id: p.player_id,
      battle_tag: p.battle_tag,
      display_name: p.display_name,
      total_points: 0,
      games_played: 0,
      total_placements: 0,
      wins: 0,
    })
  }

  for (const pl of placements) {
    if (pl.placement === null) continue
    const row = map.get(pl.player_id)
    if (!row) continue
    row.games_played++
    row.total_placements += pl.placement
    row.total_points += calcPoints(pl.placement)
    if (pl.placement === 1) row.wins++
  }

  return [...map.values()].sort((a, b) => b.total_points - a.total_points)
}

export function generateGridMatches(playerIds: number[], boN: number, existingMatches: number = 0): { players: number[]; gameNumber: number }[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const matches: { players: number[]; gameNumber: number }[] = []
  for (let r = 0; r < boN; r++) {
    matches.push({
      players: [...shuffled],
      gameNumber: existingMatches + r + 1,
    })
  }
  return matches
}

export function generateBracketMatches(playerIds: number[], existingMatches: number = 0): { players: number[]; gameNumber: number }[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  return [{
    players: shuffled,
    gameNumber: existingMatches + 1,
  }]
}
