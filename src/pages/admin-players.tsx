import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Player } from '../types'

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  players: Player[]
  adminIds: number[]
  error?: string
  message?: string
  stats?: { players: number; activeGames: number }
}

export const AdminPlayersPage: FC<Props> = ({ user, players, adminIds, error, message, stats }) => (
  <Layout title="选手管理" user={user} stats={stats}>
    <div class="max-w-4xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <h1 class="text-base sm:text-lg font-bold text-hearth-gold">选手管理</h1>
          <a href="/admin" class="text-xs text-hearth-dim hover:text-hearth-gold transition">← 返回</a>
        </div>
        <div class="p-4 sm:p-6">
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}

          <details class="mb-4 bg-black/20 rounded-lg gold-border">
            <summary class="px-4 py-2.5 cursor-pointer text-xs font-bold text-hearth-gold hover:text-hearth-accent">+ 添加选手</summary>
            <form action="/api/admin/player" method="post" class="p-4 border-t border-hearth-border flex gap-2">
              <input name="battle_tag" required placeholder="选手ID"
                class="flex-1 bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
              <input name="display_name" placeholder="昵称"
                class="flex-1 bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
              <button class="bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 font-bold px-4 py-2 rounded-lg text-sm transition">添加</button>
            </form>
          </details>

          {players.length === 0 ? (
            <p class="text-hearth-dim text-sm">暂无选手</p>
          ) : (
            <div class="overflow-x-auto rounded-lg border border-hearth-border">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                    <th class="px-4 py-2.5 text-left">选手ID</th>
                    <th class="px-4 py-2.5 text-left hide-sm">昵称</th>
                    <th class="px-4 py-2.5 text-left hide-sm">注册时间</th>
                    <th class="px-4 py-2.5 text-center">管理</th>
                    <th class="px-4 py-2.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-hearth-border/50">
                  {players.map(p => (
                    <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                      <td class="px-4 py-2.5">
                        <a href={`/player/${p.battle_tag}`} class="hover:text-hearth-gold transition">{p.battle_tag}</a>
                      </td>
                      <td class="px-4 py-2.5 text-hearth-dim hide-sm">{p.display_name || '-'}</td>
                      <td class="px-4 py-2.5 text-xs text-hearth-dim hide-sm">{p.created_at}</td>
                      <td class="px-4 py-2.5 text-center">
                        {adminIds.includes(p.id) ? (
                          <span class="text-red-400 text-xs">管理员</span>
                        ) : (
                          <form action="/api/admin/player/make-admin" method="post" class="inline">
                            <input type="hidden" name="player_id" value={p.id} />
                            <button class="text-xs text-hearth-gold hover:text-hearth-accent">设为管理</button>
                          </form>
                        )}
                      </td>
                      <td class="px-4 py-2.5 text-center">
                        <form action="/api/admin/player/delete" method="post"
                          onSubmit={"return confirm('确定删除此选手？')" as any}>
                          <input type="hidden" name="player_id" value={p.id} />
                          <button class="text-xs text-red-400 hover:text-red-300">删除</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  </Layout>
)
