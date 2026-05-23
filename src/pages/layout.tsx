import type { FC } from 'hono/jsx'

interface LayoutProps {
  title: string
  user?: { battle_tag: string; is_admin: boolean } | null
  stats?: { players: number; activeGames: number }
  children: any
}

const tailwindConfig = `tailwind.config = {
  theme: {
    extend: {
      colors: {
        hearth: {
          bg: '#1a1a2e',
          card: '#16213e',
          gold: '#e2b714',
          accent: '#c9a84c',
          dim: '#8b8b9e',
          border: '#2a2a4a',
        }
      }
    }
  }
}`

const globalCss = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
body { font-family: 'Noto Sans SC', sans-serif; }
.rank-1 { color: #ffd700; }
.rank-2 { color: #c0c0c0; }
.rank-3 { color: #cd7f32; }
.sort-btn { cursor: pointer; user-select: none; }
.sort-btn:hover { color: #e2b714; }
.active-pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.hearth-gradient { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
.gold-border { border: 1px solid rgba(226, 183, 20, 0.3); }
.gold-border:hover { border-color: rgba(226, 183, 20, 0.6); }
@media (max-width: 639px) { .hide-sm { display: none !important; } }
@media (max-width: 767px) { .hide-md { display: none !important; } }
@media (max-width: 1023px) { .hide-lg { display: none !important; } }`

const mobileMenuJs = `function toggleMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  var menuIcon = document.getElementById('menuIcon');
  var closeIcon = document.getElementById('closeIcon');
  if (!menu) return;
  var isOpen = !menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  menuIcon.classList.toggle('hidden');
  closeIcon.classList.toggle('hidden');
}
document.getElementById('mobileMenu')?.addEventListener('click', function(e) {
  if (e.target.closest('a') || e.target.closest('form')) { toggleMobileMenu(); }
});
function showConfirm(msg) {
  return new Promise(function(resolve) {
    var modal = document.getElementById('confirmModal');
    var msgEl = document.getElementById('confirmMsg');
    var okBtn = document.getElementById('confirmOk');
    var cancelBtn = document.getElementById('confirmCancel');
    var overlay = document.getElementById('confirmOverlay');
    msgEl.textContent = msg;
    modal.classList.remove('hidden');
    function close(result) {
      modal.classList.add('hidden');
      okBtn.onclick = null; cancelBtn.onclick = null;
      overlay.onclick = null; document.onkeydown = null;
      resolve(result);
    }
    okBtn.onclick = function() { close(true); };
    cancelBtn.onclick = function() { close(false); };
    overlay.onclick = function() { close(false); };
    document.onkeydown = function(e) { if (e.key === 'Escape') close(false); };
  });
}`

export const Layout: FC<LayoutProps> = ({ title, user, stats, children }) => (
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - 酒馆战棋联赛</title>
      <link rel="icon" type="image/png" sizes="32x32" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍺</text></svg>" />
      <script src="https://cdn.tailwindcss.com"></script>
      <script dangerouslySetInnerHTML={{ __html: tailwindConfig }} />
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
    </head>
    <body class="hearth-gradient min-h-screen text-gray-200">
      <nav class="border-b border-hearth-border bg-black/30 backdrop-blur">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" class="text-xl font-bold text-hearth-gold flex items-center gap-2">🍺 酒馆战棋联赛</a>
          <div class="hidden md:flex items-center gap-4 text-sm">
            <span class="text-hearth-dim">{stats?.players ?? 0} 名注册选手</span>
            <span class="text-hearth-dim">|</span>
            <a href="/enroll" class="text-hearth-dim hover:text-hearth-gold transition">报名</a>
            <span class="text-hearth-dim">|</span>
            <a href="/leaderboard" class="text-hearth-dim hover:text-hearth-gold transition">排行榜</a>
            <span class="text-hearth-dim">|</span>
            {user ? (
              <>
                <a href={`/player/${encodeURIComponent(user.battle_tag)}`} class="text-hearth-gold font-medium hover:text-hearth-accent transition whitespace-nowrap">{user.battle_tag}</a>
                {user.is_admin && <a href="/admin" class="text-hearth-dim hover:text-hearth-gold transition whitespace-nowrap" title="管理面板">⚙️</a>}
                <form action="/api/logout" method="post" style="display:contents">
                  <button class="text-hearth-dim hover:text-red-400 transition whitespace-nowrap">退出</button>
                </form>
              </>
            ) : (
              <a href="/register" class="text-hearth-gold hover:text-hearth-accent transition">登录</a>
            )}
          </div>
          <button id="mobileMenuBtn" onclick="toggleMobileMenu()" class="md:hidden text-hearth-dim hover:text-hearth-gold transition p-1">
            <svg id="menuIcon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg id="closeIcon" class="w-6 h-6 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div id="mobileMenu" class="hidden md:hidden border-t border-hearth-border bg-black/50 backdrop-blur">
          <div class="px-4 py-3 space-y-3 text-sm">
            <div class="flex items-center gap-3 text-hearth-dim">
              <span>{stats?.players ?? 0} 名注册选手</span>
            </div>
            <div class="flex flex-col gap-1">
              <a href="/enroll" class="py-2 px-3 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">📝 报名</a>
              <a href="/leaderboard" class="py-2 px-3 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">🏆 排行榜</a>
            </div>
            <div class="border-t border-hearth-border pt-3">
              {user ? (
                <>
                  <div class="px-3 flex items-center gap-x-2 whitespace-nowrap">
                    <a href={`/player/${encodeURIComponent(user.battle_tag)}`} class="text-hearth-gold font-medium hover:text-hearth-accent transition">{user.battle_tag}</a>
                    {user.is_admin && <a href="/admin" class="text-hearth-dim hover:text-hearth-gold transition" title="管理面板">⚙️</a>}
                    <form action="/api/logout" method="post" style="display:contents">
                      <button class="text-hearth-dim hover:text-red-400 transition">退出</button>
                    </form>
                  </div>
                  {user.is_admin && <a href="/admin" class="block py-2 px-3 mt-1 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">⚙️ 管理面板</a>}
                </>
              ) : (
                <a href="/register" class="block py-2 px-3 text-hearth-gold hover:text-hearth-accent transition">登录 / 注册</a>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main class="max-w-[1440px] mx-auto px-4 py-6">{children}</main>
      <footer class="text-center py-4 text-xs text-hearth-dim/50">酒馆战棋联赛 Lite</footer>

      <div id="confirmModal" class="fixed inset-0 z-[9999] hidden flex items-center justify-center">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="confirmOverlay"></div>
        <div class="relative bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl shadow-2xl max-w-md w-[90%] mx-4 p-6">
          <p id="confirmMsg" class="text-gray-200 text-sm leading-relaxed whitespace-pre-line"></p>
          <div class="flex justify-end gap-3 mt-5">
            <button id="confirmCancel" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#2a2a4a] hover:border-[#4a4a6a] rounded-lg transition">取消</button>
            <button id="confirmOk" class="px-4 py-2 text-sm text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition font-medium">确定</button>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: mobileMenuJs }} />
    </body>
  </html>
)
