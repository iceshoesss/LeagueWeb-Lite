export interface Player {
  id: number
  battle_tag: string
  display_name: string | null
  password_hash: string
  created_at: string
  last_seen: string | null
}

export interface Admin {
  player_id: number
  is_super_admin: number
}

export interface Tournament {
  id: number
  name: string
  status: 'upcoming' | 'active' | 'completed'
  created_at: string
}

export type LayoutType = 'grid' | 'bracket'

export interface TournamentGroup {
  id: number
  tournament_id: number
  name: string | null
  round: number
  group_index: number
  status: 'waiting' | 'active' | 'done'
  bo_n: number
  layout: LayoutType
  created_at: string
}

export interface GroupPlayer {
  group_id: number
  player_id: number
}

export interface Enrollment {
  id: number
  tournament_id: number
  player_id: number
  status: 'enrolled' | 'waitlisted'
  created_at: string
}

export interface EnrollmentSettings {
  tournament_id: number
  enabled: number
  deadline: string | null
  max_slots: number
}

export interface Match {
  id: number
  game_uuid: string
  group_id: number
  game_number: number
  status: 'pending' | 'completed' | 'abandoned'
  created_at: string
  completed_at: string | null
}

export interface MatchPlacement {
  match_id: number
  player_id: number
  placement: number | null
  entered_by: number | null
}

export interface MatchWithPlayers extends Match {
  players: (Player & { placement: number | null })[]
  group_name: string | null
  tournament_name: string
}

export interface GroupStanding {
  player_id: number
  battle_tag: string
  display_name: string | null
  total_points: number
  games_played: number
  avg_placement: number | null
  wins: number
}

export interface EnrichedPlayer {
  id: number
  battle_tag: string
  display_name: string | null
  created_at: string
  is_admin: boolean
}

export interface JwtPayload {
  player_id: number
  battle_tag: string
  is_admin: boolean
  iat?: number
  exp?: number
}

export interface Bindings {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT?: string
}

export interface AppVariables {
  user: JwtPayload
  admin: Admin
}
