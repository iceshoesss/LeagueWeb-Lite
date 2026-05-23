import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Match, Player } from '../types'

interface Props {
  user: { battle_tag: string; is_admin: boolean; player_id: number }
  match: Match & { players: (Player & { placement: number | null })[] }
  error?: string
  success?: string
  stats?: { players: number; activeGames: number }
}

export const MatchEditPage: FC<Props> = ({ user, match, error, success, stats }) => {
  const placements = [1, 2, 3, 4, 5, 6, 7, 8]
  return (
    <Layout title="录入成绩" user={user} stats={stats}>
      <div class="max-w-lg mx-auto">
        <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
          <div class="px-6 py-4 border-b border-hearth-border">
            <h2 class="text-lg font-bold text-hearth-gold">成绩录入</h2>
            <p class="text-xs text-hearth-dim mt-0.5">第 {match.game_number} 局</p>
          </div>
          <div class="p-6">
            {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
            {success && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{success}</div>}

            <form action={`/api/match/${match.game_uuid}/placement`} method="post" class="space-y-3">
              {match.players.map(p => {
                const isMe = p.id === user.player_id
                const canEdit = user.is_admin || isMe
                if (!canEdit) {
                  return (
                    <div class="bg-black/20 rounded-lg gold-border p-3 flex justify-between items-center">
                      <span class="text-sm text-hearth-dim">{p.display_name || p.battle_tag}</span>
                      <span class="text-xs text-hearth-dim">{p.placement ? `第${p.placement}名` : '-'}</span>
                    </div>
                  )
                }
                return (
                  <div class="bg-black/20 rounded-lg gold-border p-3">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-bold">{p.display_name || p.battle_tag}</span>
                      {isMe && <span class="text-xs text-hearth-gold">(本人)</span>}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      {placements.map(pos => {
                        const checked = p.placement === pos
                        const inputName = user.is_admin ? `placement_${p.id}` : 'placement'
                        const inputValue = user.is_admin ? String(pos) : String(pos)
                        return (
                          <label class={`cursor-pointer px-3 py-1.5 rounded text-sm font-mono border transition
                            ${checked ? 'bg-hearth-gold/20 text-hearth-gold border-hearth-gold/40' : 'bg-black/30 text-hearth-dim border-hearth-border hover:border-hearth-gold/30'}`}>
                            <input type="radio" name={inputName} value={inputValue} checked={checked}
                              class="hidden" onChange={"this.form.submit()" as any} />
                            第{pos}名
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <div class="flex gap-2 pt-2">
                {user.is_admin && (
                  <button class="flex-1 py-2.5 rounded-lg font-bold text-sm bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 border border-hearth-gold/20 transition active:scale-[0.98]">
                    保存全部
                  </button>
                )}
                <a href={`/tournament/${match.group_id}`}
                  class="text-center text-sm text-hearth-dim hover:text-hearth-gold border border-hearth-border hover:border-hearth-gold/30 px-4 py-2 rounded-lg transition">
                  返回
                </a>
              </div>
            </form>
          </div>
        </section>
      </div>
    </Layout>
  )
}
