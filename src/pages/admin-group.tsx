import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { TournamentGroup, Match, Player, Tournament } from '../types'
import { calcPoints } from '../utils/scoring'

interface MatchWithPlayers extends Match {
  players: (Player & { placement: number | null })[]
}

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  group: TournamentGroup
  tournament: Tournament
  matches: MatchWithPlayers[]
  allPlayers: Player[]
  error?: string
  message?: string
  stats?: { players: number; activeGames: number }
}

export const AdminGroupPage: FC<Props> = ({ user, group, tournament, matches, error, message, stats }) => (
  <Layout title={`管理 - ${group.name || `第${group.round}轮第${group.group_index + 1}组`}`} user={user} stats={stats}>
    <div class="max-w-4xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <div>
            <h1 class="text-base sm:text-lg font-bold text-hearth-gold">{group.name || `第${group.round}轮 第${group.group_index + 1}组`}</h1>
            <p class="text-xs text-hearth-dim">{tournament.name} · {group.layout === 'grid' ? '循环赛' : '淘汰赛'} · Bo{group.bo_n}</p>
          </div>
          <a href={`/admin/tournament/${group.tournament_id}`} class="text-xs text-hearth-dim hover:text-hearth-gold transition">← 返回赛事</a>
        </div>
        <div class="p-4 sm:p-6">
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}

          <div class="flex gap-2 mb-4">
            {group.status === 'waiting' && (
              <form action={`/api/admin/group/${group.id}/start`} method="post"
                onSubmit={"return confirm('启动后将自动生成比赛记录，确定？')" as any}>
                <button class="bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 font-bold px-4 py-2 rounded-lg text-sm transition border border-hearth-gold/20">启动分组</button>
              </form>
            )}
            {group.status === 'active' && matches.every(m => m.status === 'completed') && (
              <form action={`/api/admin/group/${group.id}/finish`} method="post"
                onSubmit={"return confirm('结束此分组？')" as any}>
                <button class="bg-green-900/30 text-green-400 hover:bg-green-900/50 font-bold px-4 py-2 rounded-lg text-sm transition border border-green-900/50">结束分组</button>
              </form>
            )}
          </div>

          {group.layout === 'bracket' && group.status !== 'waiting' && (
            <div class="mb-6 bg-black/20 rounded-lg gold-border p-4">
              <h3 class="text-sm font-bold text-hearth-gold mb-4">对阵图</h3>
              <div class="flex gap-4 overflow-x-auto pb-2">
                {matches.map(m => {
                  const sorted = [...m.players].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))
                  return (
                    <div class="flex-shrink-0 w-48">
                      <div class="text-xs text-hearth-dim mb-2 text-center font-medium">第 {m.game_number} 局</div>
                      <div class="bg-black/30 rounded-lg border border-hearth-border/50 overflow-hidden">
                        <div class="px-3 py-1.5 bg-hearth-gold/10 border-b border-hearth-border/30 text-xs text-hearth-dim text-center">
                          {m.status === 'completed' ? '已结束' : '进行中'}
                        </div>
                        {sorted.map((p, i) => (
                          <div class={`flex items-center gap-2 px-3 py-2 border-b border-hearth-border/20 last:border-0 ${p.placement === 1 ? 'bg-yellow-900/10' : ''}`}>
                            <span class={`w-5 text-center text-xs font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-hearth-dim'}`}>
                              {p.placement ?? '-'}
                            </span>
                            <span class="text-sm truncate flex-1">{p.display_name || p.battle_tag}</span>
                            {p.placement !== null && (
                              <span class="text-xs text-hearth-dim font-mono">{calcPoints(p.placement)}分</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {m !== matches[matches.length - 1] && (
                        <div class="flex justify-center py-1">
                          <svg class="w-4 h-4 text-hearth-dim/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div class="space-y-3">
            {matches.length === 0 ? (
              <div class="bg-black/20 rounded-lg gold-border p-6 text-center">
                <p class="text-hearth-dim text-sm">
                  {group.status === 'waiting' ? '分组尚未启动。确保已分配选手后点击"启动分组"。' : '暂无比赛记录'}
                </p>
              </div>
            ) : matches.map(m => {
              const allFilled = m.players.every(p => p.placement !== null)
              return (
                <div class={`rounded-lg border p-4 ${m.status === 'completed' ? 'bg-black/10 border-hearth-border/50' : 'bg-black/20 gold-border'}`}>
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-sm text-hearth-gold">第 {m.game_number} 局</span>
                    <span class={`text-xs px-2 py-0.5 rounded ${mStatusBadge(m.status)}`}>{mStatusLabel(m.status)}</span>
                  </div>
                  <div class="space-y-1 text-sm">
                    {m.players.map(p => (
                      <div class="flex justify-between py-0.5">
                        <span>{p.display_name || p.battle_tag}</span>
                        <span class="font-mono text-xs text-hearth-dim">{p.placement !== null ? `第${p.placement}名` : '-'}</span>
                      </div>
                    ))}
                  </div>
                  <div class="mt-3 flex gap-2">
                    {m.status === 'pending' && (
                      <a href={`/match/${m.game_uuid}/edit`}
                        class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-3 py-1.5 rounded-lg transition font-bold">
                        {allFilled ? '修改' : '录入'}
                      </a>
                    )}
                    <a href={`/match/${m.game_uuid}`} class="text-xs text-hearth-dim hover:text-hearth-gold px-3 py-1.5 transition">详情</a>
                    {m.status === 'pending' && allFilled && (
                      <form action={`/api/admin/match/${m.id}/complete`} method="post">
                        <button class="text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50 px-3 py-1.5 rounded-lg transition">完成比赛</button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  </Layout>
)

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
