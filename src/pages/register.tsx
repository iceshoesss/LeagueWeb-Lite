import type { FC } from 'hono/jsx'
import { Layout } from './layout'

interface Props {
  user?: { battle_tag: string; is_admin: boolean } | null
  error?: string
  mode?: 'login' | 'register'
  stats?: { players: number; activeGames: number }
  firstAdmin?: boolean
}

export const RegisterPage: FC<Props> = ({ user, error, mode = 'login', stats, firstAdmin }) => (
  <Layout title="登录" user={user} stats={stats}>
    <div class="max-w-md mx-auto mt-12">
      <div class="bg-hearth-card rounded-xl gold-border overflow-hidden">
        <div class="px-6 py-5 border-b border-hearth-border">
          <h2 class="text-lg font-bold text-hearth-gold">{mode === 'register' ? '注册' : '登录'}</h2>
        </div>
        <div class="p-6">
          {firstAdmin && (
            <div class="bg-yellow-900/30 text-yellow-400 px-4 py-2 rounded-lg mb-4 text-sm border border-yellow-900/50">
              系统暂无管理员，首个注册用户将自动成为管理员
            </div>
          )}
          {error && <div class="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm border border-red-900/50">{error}</div>}

          <form action={mode === 'register' ? '/api/register' : '/api/login'} method="post" class="space-y-4">
            <div>
              <label class="block text-xs text-hearth-dim mb-1">选手ID</label>
              <input name="battle_tag" required
                class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition"
                placeholder="选手ID" />
            </div>
            <div>
              <label class="block text-xs text-hearth-dim mb-1">密码</label>
              <input name="password" type="password" required
                class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
            </div>
            {mode === 'register' && (
              <div>
                <label class="block text-xs text-hearth-dim mb-1">昵称 <span class="text-hearth-dim/50">(可选)</span></label>
                <input name="display_name"
                  class="w-full bg-black/30 border border-hearth-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-hearth-dim focus:outline-none focus:border-hearth-gold/50 transition" />
              </div>
            )}
            <button class="w-full py-2.5 rounded-lg font-bold text-sm bg-hearth-gold/20 text-hearth-gold hover:bg-hearth-gold/30 border border-hearth-gold/20 transition active:scale-[0.98]">
              {mode === 'register' ? '注册' : '登录'}
            </button>
          </form>

          <div class="mt-4 text-center text-xs text-hearth-dim">
            {mode === 'login' ? (
              <a href="/register?mode=register" class="hover:text-hearth-gold transition">没有账号？注册</a>
            ) : (
              <a href="/register" class="hover:text-hearth-gold transition">已有账号？登录</a>
            )}
          </div>
        </div>
      </div>
    </div>
  </Layout>
)
