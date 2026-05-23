import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament } from '../types'

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  tournaments: Tournament[]
  error?: string
  message?: string
  stats?: { players: number; activeGames: number }
}

export const AdminTournamentsPage: FC<Props> = ({ user, tournaments, error, message, stats }) => (
  <Layout title="赛事管理" user={user} stats={stats}>
    <div class="max-w-3xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border flex items-center justify-between">
          <h1 class="text-base sm:text-lg font-bold text-hearth-gold">赛事管理</h1>
          <a href="/admin" class="text-xs text-hearth-dim hover:text-hearth-gold transition">← 返回</a>
        </div>
        <div class="p-4 sm:p-6">
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}

          <details class="mb-4 bg-black/20 rounded-lg gold-border">
            <summary class="px-4 py-2.5 cursor-pointer text-xs font-bold text-hearth-gold hover:text-hearth-accent">+ 创建赛事</summary>
            <form action="/api/admin/tournament" method="post" class="p-4 border-t border-hearth-border flex gap-2">
              <input name="name" required placeholder="赛事名称"
                class="flex-1 bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
              <button class="bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 font-bold px-4 py-2 rounded-lg text-sm transition">创建</button>
            </form>
          </details>

          <div class="space-y-2">
            {tournaments.length === 0 ? (
              <p class="text-hearth-dim text-sm">暂无赛事</p>
            ) : tournaments.map(t => (
              <div class="flex items-center bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
                <a href={`/admin/tournament/${t.id}`} class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h2 class="font-bold text-sm truncate">{t.name}</h2>
                    <span class={`ml-2 text-xs px-2 py-0.5 rounded shrink-0 ${sBadge(t.status)}`}>{sLabel(t.status)}</span>
                  </div>
                  <p class="text-xs text-hearth-dim mt-1">创建于 {t.created_at}</p>
                </a>
                {t.status === 'upcoming' && (
                  <form action={`/api/admin/tournament/${t.id}/delete`} method="post"
                    onSubmit={"return confirm('确定删除此赛事及其所有分组和数据？')" as any}
                    class="ml-2 shrink-0">
                    <button class="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 px-2 py-1 rounded-lg transition">删除</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
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
