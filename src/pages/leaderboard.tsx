import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, TournamentGroup, GroupStanding } from '../types'

interface TournamentWithStandings extends Tournament {
  groups: { group: TournamentGroup; rows: GroupStanding[] }[]
}

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  tournaments: TournamentWithStandings[]
  stats?: { players: number; activeGames: number }
}

export const LeaderboardPage: FC<Props> = ({ user, tournaments, stats }) => (
  <Layout title="排行榜" user={user} stats={stats}>
    <div class="space-y-6">
      {tournaments.length === 0 ? (
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border">
            <h1 class="text-base sm:text-lg font-bold text-hearth-gold">排行榜</h1>
          </div>
          <div class="p-4 sm:p-6">
            <p class="text-hearth-dim text-sm">暂无比赛数据</p>
          </div>
        </section>
      ) : tournaments.map(t => (
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-bold text-hearth-gold">
              <a href={`/tournament/${t.id}`} class="hover:text-hearth-accent">{t.name}</a>
            </h2>
            <span class={`text-xs px-2 py-0.5 rounded ${sBadge(t.status)}`}>{sLabel(t.status)}</span>
          </div>
          <div class="p-4 sm:p-6 space-y-4">
            {t.groups.map(({ group, rows }) => (
              <div class="bg-black/20 rounded-lg gold-border overflow-hidden">
                <div class="px-4 py-2 bg-black/30 border-b border-hearth-border/50">
                  <h3 class="text-xs font-bold text-hearth-gold">{group.name || `第${group.round}轮 第${group.group_index + 1}组`}</h3>
                </div>
                {rows.length === 0 ? (
                  <p class="p-4 text-hearth-dim text-xs">暂无数据</p>
                ) : (
                  <div class="overflow-x-auto">
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
                        {rows.map((r, i) => (
                          <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                            <td class={`px-4 py-2.5 font-bold ${i < 3 ? `rank-${i + 1}` : 'text-hearth-dim'}`}>{i + 1}</td>
                            <td class="px-4 py-2.5">
                              <a href={`/player/${r.battle_tag}`} class="hover:text-hearth-gold transition">{r.display_name || r.battle_tag}</a>
                            </td>
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
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  </Layout>
)

function sBadge(s: string): string {
  switch (s) {
    case 'upcoming': return 'bg-blue-900/50 text-blue-300'
    case 'active': return 'bg-green-900/50 text-green-300'
    case 'completed': return 'bg-gray-700/50 text-gray-400'
    default: return 'bg-gray-700/50'
  }
}
function sLabel(s: string): string {
  switch (s) {
    case 'upcoming': return '即将开始'
    case 'active': return '进行中'
    case 'completed': return '已结束'
    default: return s
  }
}
