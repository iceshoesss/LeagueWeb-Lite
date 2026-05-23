import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Player, Match } from '../types'

interface MatchItem extends Match {
  placement: number | null
  players: { battle_tag: string; display_name: string | null; placement: number | null }[]
}

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  player: Player
  matches: MatchItem[]
  stats?: { players: number; activeGames: number }
}

export const PlayerPage: FC<Props> = ({ user, player, matches, stats }) => (
  <Layout title={player.display_name || player.battle_tag} user={user} stats={stats}>
    <div class="max-w-3xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-6 py-4 border-b border-hearth-border">
          <h1 class="text-xl font-bold text-hearth-gold">{player.display_name || player.battle_tag}</h1>
          <p class="text-xs text-hearth-dim mt-0.5">加入于 {player.created_at}</p>
        </div>

        <div class="p-6">
          <h2 class="text-sm font-bold text-hearth-gold mb-3">最近比赛</h2>
          {matches.length === 0 ? (
            <p class="text-hearth-dim text-sm">暂无比赛记录</p>
          ) : (
            <div class="space-y-2">
              {matches.map(m => (
                <a href={m.status === 'completed' ? `/match/${m.game_uuid}` : `/match/${m.game_uuid}/edit`}
                  class="block bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
                  <div class="flex items-center justify-between text-sm">
                    <span>第 {m.game_number} 局</span>
                    <span class={`text-xs px-2 py-0.5 rounded ${m.status === 'completed' ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                      {m.status === 'completed' ? '已完成' : '待录入'}
                    </span>
                  </div>
                  <div class="text-sm mt-1">
                    {m.placement !== null ? (
                      <span class="text-hearth-gold font-bold">第{m.placement}名 ({[9, 7, 6, 5, 4, 3, 2, 1][m.placement - 1] || 0}分)</span>
                    ) : (
                      <span class="text-hearth-dim">未录入</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  </Layout>
)
