import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, TournamentGroup, GroupStanding } from '../types'

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  tournaments: (Tournament & { groups: TournamentGroup[] })[]
  standings: { group: TournamentGroup; rows: GroupStanding[] }[]
  stats?: { players: number; activeGames: number }
}

export const Home: FC<Props> = ({ user, tournaments, standings, stats }) => (
  <Layout title="首页" user={user} stats={stats}>
    <div class="space-y-6">
      {tournaments.length > 0 && (
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border">
            <h2 class="text-base sm:text-lg font-bold text-hearth-gold">赛事</h2>
          </div>
          <div class="p-4 sm:p-6 grid gap-3 sm:grid-cols-2">
            {tournaments.map(t => (
              <a href={`/tournament/${t.id}`}
                class="block bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
                <div class="flex items-center justify-between">
                  <h3 class="font-bold text-hearth-gold">{t.name}</h3>
                  <span class={`text-xs px-2 py-0.5 rounded ${statusBadge(t.status)}`}>{statusLabel(t.status)}</span>
                </div>
                <p class="text-xs text-hearth-dim mt-1">{t.groups.length} 个分组</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {standings.map(({ group, rows }) => (
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border">
            <h2 class="text-base sm:text-lg font-bold text-hearth-gold">
              <a href={`/tournament/${group.tournament_id}`} class="hover:text-hearth-accent">
                {group.name || `第${group.round}轮 第${group.group_index + 1}组`}
              </a>
            </h2>
          </div>
          {rows.length === 0 ? (
            <p class="p-6 text-hearth-dim text-sm">暂无数据</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                    <th class="px-5 py-3 text-left">#</th>
                    <th class="px-5 py-3 text-left">选手</th>
                    <th class="px-5 py-3 text-right">积分</th>
                    <th class="px-5 py-3 text-right hide-sm">场次</th>
                    <th class="px-5 py-3 text-right hide-sm">平均</th>
                    <th class="px-5 py-3 text-right hide-sm">第1</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-hearth-border/50">
                  {rows.map((r, i) => (
                    <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                      <td class={`px-5 py-3 font-bold ${i < 3 ? `rank-${i + 1}` : 'text-hearth-dim'}`}>{i + 1}</td>
                      <td class="px-5 py-3">
                        <a href={`/player/${r.battle_tag}`} class="hover:text-hearth-gold transition">{r.display_name || r.battle_tag}</a>
                      </td>
                      <td class="px-5 py-3 text-right font-bold text-hearth-gold">{r.total_points}</td>
                      <td class="px-5 py-3 text-right text-hearth-dim hide-sm">{r.games_played}</td>
                      <td class="px-5 py-3 text-right text-hearth-dim hide-sm">{r.avg_placement !== null ? r.avg_placement.toFixed(1) : '-'}</td>
                      <td class="px-5 py-3 text-right hide-sm">{r.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
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
