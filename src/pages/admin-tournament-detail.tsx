import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, TournamentGroup, Player } from '../types'
import { calcPoints } from '../utils/scoring'

interface MatchPlayer {
  id: number; battle_tag: string; display_name: string | null; placement: number | null
}
interface MatchBrief {
  id: number; game_uuid: string; game_number: number; status: string; players: MatchPlayer[]
}

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  tournament: Tournament
  groups: TournamentGroup[]
  groupsWithMatches: Record<number, MatchBrief[]>
  allPlayers: Player[]
  enrolledPlayerIds: number[]
  error?: string
  message?: string
  stats?: { players: number; activeGames: number }
}

export const AdminTournamentDetail: FC<Props> = ({ user, tournament, groups, groupsWithMatches, allPlayers, error, message, stats }) => (
  <Layout title={tournament.name} user={user} stats={stats}>
    <div class="max-w-4xl mx-auto space-y-4">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <div>
            <h1 class="text-base sm:text-lg font-bold text-hearth-gold">{tournament.name}</h1>
            <p class="text-xs text-hearth-dim">创建于 {tournament.created_at}</p>
          </div>
          <a href="/admin/tournaments" class="text-xs text-hearth-dim hover:text-hearth-gold transition">← 返回</a>
        </div>
        <div class="p-4 sm:p-6">
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}

          <div class="flex gap-2 mb-4">
            <form action={`/api/admin/tournament/${tournament.id}/status`} method="post">
              <input type="hidden" name="status" value={tournament.status === 'upcoming' ? 'active' : tournament.status === 'active' ? 'completed' : 'upcoming'} />
              <button class={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${tournament.status === 'upcoming' ? 'bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 border border-hearth-gold/20' : tournament.status === 'active' ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-900/50' : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'}`}>
                {tournament.status === 'upcoming' ? '开始赛事' : tournament.status === 'active' ? '结束赛事' : '重新开启'}
              </button>
            </form>
          </div>

          <details class="mb-4 bg-black/20 rounded-lg gold-border">
            <summary class="px-4 py-2.5 cursor-pointer text-xs font-bold text-hearth-gold hover:text-hearth-accent">+ 添加分组</summary>
            <form action={`/api/admin/tournament/${tournament.id}/group`} method="post" class="p-4 border-t border-hearth-border space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-hearth-dim mb-1">分组名称</label>
                  <input name="name" placeholder="A组"
                    class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
                </div>
                <div>
                  <label class="block text-xs text-hearth-dim mb-1">轮次</label>
                  <input name="round" type="number" value={1} min={1}
                    class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition" />
                </div>
                <div>
                  <label class="block text-xs text-hearth-dim mb-1">布局</label>
                  <select name="layout"
                    class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition cursor-pointer">
                    <option value="grid" class="bg-hearth-card">循环赛 (Grid)</option>
                    <option value="bracket" class="bg-hearth-card">淘汰赛 (Bracket)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-hearth-dim mb-1">BoN</label>
                  <input name="bo_n" type="number" value={3} min={1} max={9}
                    class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition" />
                </div>
              </div>
              <button class="bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 font-bold px-4 py-2 rounded-lg text-sm transition">创建分组</button>
            </form>
          </details>

          <div class="space-y-3">
            {groups.length === 0 ? (
              <p class="text-hearth-dim text-sm">暂无分组，请先添加分组</p>
            ) : groups.map(g => (
              <div class="bg-black/20 rounded-lg gold-border p-4">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h2 class="font-bold text-sm">{g.name || `第${g.round}轮 第${g.group_index + 1}组`}</h2>
                    <p class="text-xs text-hearth-dim">
                      {g.layout === 'grid' ? '循环赛' : '淘汰赛'} · Bo{g.bo_n} ·
                      <span class={g.status === 'waiting' ? 'text-blue-400' : g.status === 'active' ? 'text-green-400' : 'text-hearth-dim'}>
                        {g.status === 'waiting' ? '等待中' : g.status === 'active' ? '进行中' : '已结束'}
                      </span>
                    </p>
                  </div>
                  <div class="flex gap-2 items-center flex-shrink-0">
                    {g.status === 'waiting' ? (
                      <>
                        <a href={`/admin/group/${g.id}`}
                          class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-3 py-1.5 rounded-lg transition font-bold">管理</a>
                        <form action={`/api/admin/group/${g.id}/auto-assign`} method="post"
                          onSubmit={"return confirm('将从报名池随机分配选手到这组？')" as any}
                          style="display:contents">
                          <button class="text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50 px-3 py-1.5 rounded-lg transition">自动分配</button>
                        </form>
                      </>
                    ) : (
                      <a href={`/admin/group/${g.id}`}
                        class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-3 py-1.5 rounded-lg transition font-bold">查看</a>
                    )}
                    {g.status === 'waiting' && (
                      <form action={`/api/admin/group/${g.id}/delete`} method="post"
                        onSubmit={"return confirm('确定删除此分组？')" as any}
                        style="display:contents">
                        <button class="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 px-3 py-1.5 rounded-lg transition">删除</button>
                      </form>
                    )}
                  </div>
                </div>
                {g.status === 'waiting' && (
                  <div>
                    <p class="text-xs text-hearth-dim mb-2">组内选手:</p>
                    <form action={`/api/admin/group/${g.id}/assign`} method="post">
                      <div class="flex flex-wrap gap-1.5 mb-2 max-h-32 overflow-y-auto">
                        {allPlayers.map(p => (
                          <label class="flex items-center gap-1 text-xs bg-black/30 px-2 py-1 rounded cursor-pointer hover:bg-white/5 transition">
                            <input type="checkbox" name="player_ids" value={p.id} class="accent-hearth-gold" />
                            {p.display_name || p.battle_tag}
                          </label>
                        ))}
                      </div>
                      <button class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 font-bold px-3 py-1.5 rounded-lg transition">保存分配</button>
                    </form>
                  </div>
                )}
                {g.layout === 'bracket' && g.status !== 'waiting' && groupsWithMatches[g.id] && groupsWithMatches[g.id].length > 0 && (
                  <div class="mt-3 pt-3 border-t border-hearth-border/30">
                    <p class="text-xs font-bold text-hearth-gold mb-2">对阵图</p>
                    <div class="flex gap-3 overflow-x-auto pb-1">
                      {(groupsWithMatches[g.id] as MatchBrief[]).map(m => {
                        const sorted = [...m.players].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))
                        return (
                          <div class="flex-shrink-0 w-36">
                            <div class="bg-black/30 rounded border border-hearth-border/40 overflow-hidden">
                              <div class="px-2 py-1 bg-hearth-gold/10 text-xs text-hearth-dim text-center border-b border-hearth-border/30">第{m.game_number}局</div>
                              {sorted.map((p, i) => (
                                <div class={`flex items-center gap-1 px-2 py-1 border-b border-hearth-border/20 last:border-0 text-xs ${p.placement === 1 ? 'bg-yellow-900/10' : ''}`}>
                                  <span class={`w-4 text-center font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-hearth-dim'}`}>{p.placement ?? '-'}</span>
                                  <span class="truncate flex-1">{p.display_name || p.battle_tag}</span>
                                  <span class="text-hearth-dim">{p.placement !== null ? calcPoints(p.placement) + '分' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  </Layout>
)
