import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Match, Player } from '../types'

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  match: Match & { players: (Player & { placement: number | null })[] }
  stats?: { players: number; activeGames: number }
}

export const MatchPage: FC<Props> = ({ user, match, stats }) => {
  const sorted = [...match.players].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
  return (
    <Layout title="比赛详情" user={user} stats={stats}>
      <div class="max-w-lg mx-auto">
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-6 py-4 border-b border-hearth-border">
            <h2 class="text-lg font-bold text-hearth-gold">比赛详情</h2>
            <p class="text-xs text-hearth-dim mt-0.5">第 {match.game_number} 局 · {match.status === 'completed' ? '已完成' : '待录入'}</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                  <th class="px-5 py-3 text-left">名次</th>
                  <th class="px-5 py-3 text-left">选手</th>
                  <th class="px-5 py-3 text-right">积分</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-hearth-border/50">
                {sorted.map((p, i) => (
                  <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                    <td class="px-5 py-3 font-bold w-16">{p.placement !== null ? <span class={i < 3 ? `rank-${i + 1}` : ''}>{p.placement}</span> : '-'}</td>
                    <td class="px-5 py-3">{p.display_name || p.battle_tag}</td>
                    <td class="px-5 py-3 text-right font-bold text-hearth-gold">{p.placement !== null ? calcPoints(p.placement) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="p-4 border-t border-hearth-border text-center">
            <a href={`/tournament/${match.group_id}`} class="text-xs text-hearth-dim hover:text-hearth-gold transition">返回对阵图</a>
          </div>
        </section>
      </div>
    </Layout>
  )
}

function calcPoints(placement: number): number {
  const rule = [9, 7, 6, 5, 4, 3, 2, 1]
  if (placement < 1 || placement > rule.length) return 0
  return rule[placement - 1]
}
