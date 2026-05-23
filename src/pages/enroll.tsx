import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Tournament, EnrollmentSettings, Player } from '../types'

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  tournaments: (Tournament & { settings: EnrollmentSettings | null; enrolled: boolean })[]
  enrollments: Record<number, Player[]>
  message?: string
  error?: string
  stats?: { players: number; activeGames: number }
}

export const EnrollPage: FC<Props> = ({ user, tournaments, enrollments, message, error, stats }) => (
  <Layout title="报名" user={user} stats={stats}>
    <div class="max-w-2xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-hearth-border">
          <h2 class="text-base sm:text-lg font-bold text-hearth-gold">赛事报名</h2>
        </div>
        <div class="p-4 sm:p-6">
          {message && <div class="bg-green-900/30 text-green-400 px-4 py-2 rounded-lg mb-4 text-sm border border-green-900/50">{message}</div>}
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}

          <div class="space-y-3">
            {tournaments.length === 0 ? (
              <p class="text-hearth-dim text-sm">暂无开放报名的赛事</p>
            ) : tournaments.map(t => {
              const enrolledPlayers = enrollments[t.id] || []
              return (
              <div class="bg-black/20 rounded-lg gold-border p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-bold text-sm">{t.name}</h3>
                    <p class="text-xs text-hearth-dim mt-0.5">
                      {t.settings?.enabled ? '报名开放中' : '报名已关闭'}
                      {t.settings?.max_slots ? ` · 上限 ${t.settings.max_slots} 人` : ''}
                      {' · '}<span class="text-hearth-gold">{enrolledPlayers.length}</span> 人已报名
                    </p>
                  </div>
                  {t.enrolled ? (
                    <form action="/api/enroll/withdraw" method="post">
                      <input type="hidden" name="tournament_id" value={t.id} />
                      <button class="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 px-3 py-1.5 rounded-lg transition">取消报名</button>
                    </form>
                  ) : t.settings?.enabled ? (
                    <form action="/api/enroll" method="post">
                      <input type="hidden" name="tournament_id" value={t.id} />
                      <button class="text-xs bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 px-3 py-1.5 rounded-lg transition font-bold">报名</button>
                    </form>
                  ) : (
                    <span class="text-xs text-hearth-dim">已关闭</span>
                  )}
                </div>
                {enrolledPlayers.length > 0 && (
                  <details class="mt-3">
                    <summary class="text-xs text-hearth-dim cursor-pointer hover:text-hearth-gold transition">已报名选手 ({enrolledPlayers.length})</summary>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      {enrolledPlayers.map(p => (
                        <span class="text-xs bg-black/30 px-2 py-1 rounded text-hearth-dim">{p.display_name || p.battle_tag}</span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )})}
          </div>
        </div>
      </section>
    </div>
  </Layout>
)
