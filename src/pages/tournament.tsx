import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, TournamentGroup, Match, Player, GroupStanding } from '../types'

interface MatchWithDetails extends Match {
  players: (Player & { placement: number | null })[]
}

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  tournament: Tournament
  groups: TournamentGroup[]
  matches: Record<number, MatchWithDetails[]>
  standings: { group: TournamentGroup; rows: GroupStanding[] }[]
  stats?: { players: number; activeGames: number }
}

export const TournamentPage: FC<Props> = ({ user, tournament, groups, matches, standings, stats }) => (
  <Layout title={tournament.name} user={user} stats={stats}>
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <h1 class="text-xl sm:text-2xl font-bold text-hearth-gold">{tournament.name}</h1>
        <span class={`text-xs px-2 py-0.5 rounded ${statusBadge(tournament.status)}`}>{statusLabel(tournament.status)}</span>
      </div>

      {groups.length === 0 ? (
        <div class="bg-hearth-card rounded-xl gold-border p-6 text-hearth-dim text-sm">暂无分组</div>
      ) : groups.map((group, gi) => {
        const groupMatches = matches[group.id] || []
        const groupStanding = standings.find(s => s.group.id === group.id)
        return (
          <section key={group.id} class="bg-hearth-card rounded-xl gold-border overflow-hidden">
            <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
              <h2 class="text-base sm:text-lg font-bold text-hearth-gold">
                {group.name || `第${group.round}轮 第${group.group_index + 1}组`}
              </h2>
              <div class="flex items-center gap-2">
                <span class={`text-xs px-2 py-0.5 rounded ${gStatusBadge(group.status)}`}>{gStatusLabel(group.status)}</span>
                <span class="text-xs text-hearth-dim">{group.layout === 'grid' ? '循环赛' : '淘汰赛'} · Bo{group.bo_n}</span>
              </div>
            </div>
            <div class="p-4 sm:p-6 space-y-4">
              {group.status !== 'waiting' && groupStanding && (
                <div class="overflow-x-auto rounded-lg border border-hearth-border">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                        <th class="px-4 py-2.5 text-left">#</th>
                        <th class="px-4 py-2.5 text-left">选手</th>
                        <th class="px-4 py-2.5 text-right">积分</th>
                        <th class="px-4 py-2.5 text-right hide-sm">场次</th>
                        <th class="px-4 py-2.5 text-right hide-sm">平均</th>
                        <th class="px-4 py-2.5 text-right hide-sm">第1</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-hearth-border/50">
                      {groupStanding.rows.map((r, i) => (
                        <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                          <td class={`px-4 py-2.5 font-bold ${i < 3 ? `rank-${i + 1}` : 'text-hearth-dim'}`}>{i + 1}</td>
                          <td class="px-4 py-2.5"><a href={`/player/${r.battle_tag}`} class="hover:text-hearth-gold transition">{r.display_name || r.battle_tag}</a></td>
                          <td class="px-4 py-2.5 text-right font-bold text-hearth-gold">{r.total_points}</td>
                          <td class="px-4 py-2.5 text-right text-hearth-dim hide-sm">{r.games_played}</td>
                          <td class="px-4 py-2.5 text-right text-hearth-dim hide-sm">{r.avg_placement !== null ? r.avg_placement.toFixed(1) : '-'}</td>
                          <td class="px-4 py-2.5 text-right hide-sm">{r.wins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div class="grid gap-3 md:grid-cols-2">
                {groupMatches.map(m => {
                  const isParticipant = user && m.players.some(p => p.battle_tag === user.battle_tag)
                  const canEdit = m.status === 'pending' && (user?.is_admin || isParticipant)
                  const allFilled = m.players.length > 0 && m.players.every(p => p.placement !== null)
                  return (
                    <div class={`rounded-lg border p-4 ${m.status === 'completed' ? 'bg-black/10 border-hearth-border/50' : 'bg-black/20 gold-border'}`}>
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-bold text-hearth-gold">第 {m.game_number} 局</span>
                        <span class={`text-xs px-2 py-0.5 rounded ${mStatusBadge(m.status)}`}>{mStatusLabel(m.status)}</span>
                      </div>
                      <div class="space-y-1 text-sm">
                        {m.players.map(p => (
                          <div class="flex justify-between items-center py-0.5">
                            <span class={p.placement !== null ? 'text-gray-200' : 'text-hearth-dim'}>{p.display_name || p.battle_tag}</span>
                            <span class="font-mono text-xs text-hearth-dim">
                              {p.placement !== null ? `第${p.placement}名` : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div class="mt-3 flex gap-2">
                        {canEdit && (
                          <a href={`/match/${m.game_uuid}/edit`}
                            class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-3 py-1.5 rounded-lg transition font-bold">
                            {allFilled ? '修改' : '录入'}
                          </a>
                        )}
                        {m.status === 'completed' && (
                          <a href={`/match/${m.game_uuid}`} class="text-xs text-hearth-dim hover:text-hearth-gold px-3 py-1.5">详情</a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {groupMatches.length === 0 && group.status !== 'waiting' && (
                <p class="text-hearth-dim text-sm">暂无比赛记录</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  </Layout>
)

function statusBadge(s: string): string {
  switch (s) {
    case 'upcoming': return 'bg-blue-900/50 text-blue-300'
    case 'active': return 'bg-green-900/50 text-green-300'
    case 'completed': return 'bg-gray-700/50 text-gray-400'
    default: return 'bg-gray-700/50'
  }
}
function statusLabel(s: string): string {
  switch (s) {
    case 'upcoming': return '即将开始'
    case 'active': return '进行中'
    case 'completed': return '已结束'
    default: return s
  }
}
function gStatusBadge(s: string): string {
  switch (s) {
    case 'waiting': return 'bg-blue-900/50 text-blue-300'
    case 'active': return 'bg-green-900/50 text-green-300'
    case 'done': return 'bg-gray-700/50 text-gray-400'
    default: return 'bg-gray-700/50'
  }
}
function gStatusLabel(s: string): string {
  switch (s) {
    case 'waiting': return '等待中'
    case 'active': return '进行中'
    case 'done': return '已结束'
    default: return s
  }
}
function mStatusBadge(s: string): string {
  switch (s) {
    case 'pending': return 'bg-yellow-900/50 text-yellow-300'
    case 'completed': return 'bg-green-900/50 text-green-300'
    case 'abandoned': return 'bg-red-900/50 text-red-300'
    default: return 'bg-gray-700/50'
  }
}
function mStatusLabel(s: string): string {
  switch (s) {
    case 'pending': return '待录入'
    case 'completed': return '已完成'
    case 'abandoned': return '已放弃'
    default: return s
  }
}
