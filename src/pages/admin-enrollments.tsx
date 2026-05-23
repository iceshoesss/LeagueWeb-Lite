import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, EnrollmentSettings, Player } from '../types'

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  tournaments: Tournament[]
  settings: Record<number, EnrollmentSettings | null>
  enrollments: Record<number, (Player & { created_at: string })[]>
  error?: string
  message?: string
  stats?: { players: number; activeGames: number }
}

export const AdminEnrollmentsPage: FC<Props> = ({ user, tournaments, settings, enrollments, error, message, stats }) => (
  <Layout title="报名管理" user={user} stats={stats}>
    <div class="max-w-3xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <h1 class="text-base sm:text-lg font-bold text-hearth-gold">报名管理</h1>
          <a href="/admin" class="text-xs text-hearth-dim hover:text-hearth-gold transition">← 返回</a>
        </div>
        <div class="p-4 sm:p-6">
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}

          <div class="space-y-4">
            {tournaments.length === 0 ? (
              <p class="text-hearth-dim text-sm">暂无赛事</p>
            ) : tournaments.map(t => {
              const s = settings[t.id]
              const enrolled = enrollments[t.id] || []
              return (
                <div class="bg-black/20 rounded-lg gold-border p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <h2 class="font-bold text-sm">{t.name}</h2>
                      <p class="text-xs text-hearth-dim">
                        已报名: <span class="text-hearth-gold font-bold">{enrolled.length}</span> 人
                        {s?.max_slots ? ` / 上限 ${s.max_slots} 人` : ''}
                        {s?.enabled ? ' · 报名开放中' : ' · 报名已关闭'}
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <form action={`/api/admin/enrollment/${t.id}/toggle`} method="post">
                        <button class={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${s?.enabled ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-900/50'}`}>
                          {s?.enabled ? '关闭报名' : '开放报名'}
                        </button>
                      </form>
                      <form action={`/api/admin/enrollment/${t.id}/settings`} method="post" class="flex gap-1 items-center">
                        <input name="max_slots" type="number" defaultValue={s?.max_slots || 1024} min={1}
                          class="w-16 bg-black/30 border border-hearth-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-hearth-gold/50 transition" />
                        <button class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-2 py-1 rounded-lg transition">设置</button>
                      </form>
                    </div>
                  </div>

                  {enrolled.length > 0 ? (
                    <div class="overflow-x-auto rounded-lg border border-hearth-border">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="text-hearth-dim text-xs uppercase tracking-wider border-b border-hearth-border">
                            <th class="px-4 py-2.5 text-left">选手</th>
                            <th class="px-4 py-2.5 text-left hide-sm">昵称</th>
                            <th class="px-4 py-2.5 text-left hide-sm">报名时间</th>
                            <th class="px-4 py-2.5 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-hearth-border/50">
                          {enrolled.map(e => (
                            <tr class="border-b border-hearth-border/50 hover:bg-white/5 transition">
                              <td class="px-4 py-2.5">{e.battle_tag}</td>
                              <td class="px-4 py-2.5 text-hearth-dim hide-sm">{e.display_name || '-'}</td>
                              <td class="px-4 py-2.5 text-xs text-hearth-dim hide-sm">{e.created_at}</td>
                              <td class="px-4 py-2.5 text-center">
                                <form action={`/api/admin/enrollment/${t.id}/remove`} method="post"
                                  onSubmit={"return confirm('确定移除？')" as any}>
                                  <input type="hidden" name="player_id" value={e.id} />
                                  <button class="text-xs text-red-400 hover:text-red-300">移除</button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p class="text-hearth-dim text-sm">暂无报名</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  </Layout>
)
