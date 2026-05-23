import type { FC } from 'hono/jsx'
import { Layout } from './layout'

interface Props {
  user: { battle_tag: string; is_admin: boolean }
  stats: { players: number; tournaments: number; activeGroups: number; pendingMatches: number }
  navStats?: { players: number; activeGames: number }
}

export const AdminPage: FC<Props> = ({ user, stats, navStats }) => (
  <Layout title="管理后台" user={user} stats={navStats}>
    <div class="max-w-2xl mx-auto">
      <section class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-6 py-4 border-b border-hearth-border">
          <h1 class="text-lg font-bold text-hearth-gold">管理后台</h1>
          <p class="text-xs text-hearth-dim mt-0.5">欢迎, {user.battle_tag}</p>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-4 gap-3 mb-6">
            <div class="bg-black/20 rounded-lg gold-border p-3 text-center">
              <div class="text-xl font-bold text-hearth-gold">{stats.players}</div>
              <div class="text-xs text-hearth-dim">选手</div>
            </div>
            <div class="bg-black/20 rounded-lg gold-border p-3 text-center">
              <div class="text-xl font-bold text-hearth-gold">{stats.tournaments}</div>
              <div class="text-xs text-hearth-dim">赛事</div>
            </div>
            <div class="bg-black/20 rounded-lg gold-border p-3 text-center">
              <div class="text-xl font-bold text-hearth-gold">{stats.activeGroups}</div>
              <div class="text-xs text-hearth-dim">活跃分组</div>
            </div>
            <div class="bg-black/20 rounded-lg gold-border p-3 text-center">
              <div class="text-xl font-bold text-hearth-gold text-yellow-300">{stats.pendingMatches}</div>
              <div class="text-xs text-hearth-dim">待录入</div>
            </div>
          </div>

          <div class="space-y-3">
            <a href="/admin/players"
              class="block bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
              <div class="flex items-center gap-4">
                <span class="text-2xl">👤</span>
                <div>
                  <h2 class="text-sm font-bold text-hearth-gold">选手管理</h2>
                  <p class="text-xs text-hearth-dim">添加/删除选手，查看注册列表</p>
                </div>
              </div>
            </a>
            <a href="/admin/tournaments"
              class="block bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
              <div class="flex items-center gap-4">
                <span class="text-2xl">🏆</span>
                <div>
                  <h2 class="text-sm font-bold text-hearth-gold">赛事管理</h2>
                  <p class="text-xs text-hearth-dim">创建赛事，管理分组，分配选手</p>
                </div>
              </div>
            </a>
            <a href="/admin/enrollments"
              class="block bg-black/20 rounded-lg gold-border p-4 hover:bg-white/5 transition">
              <div class="flex items-center gap-4">
                <span class="text-2xl">📋</span>
                <div>
                  <h2 class="text-sm font-bold text-hearth-gold">报名管理</h2>
                  <p class="text-xs text-hearth-dim">开启/关闭报名，管理报名列表</p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  </Layout>
)
