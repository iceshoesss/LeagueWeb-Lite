import { html } from 'hono/html';

interface LayoutProps {
  children: any;
  title?: string;
  activeCount?: number;
  playerCount?: number;
  currentUser?: { battleTag: string; displayName: string } | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  siteName?: string;
  webVersion?: string;
  extraHead?: string;
  archived?: boolean;
}

export function Layout(props: LayoutProps) {
  const {
    children, title, activeCount = 0, playerCount = 0,
    currentUser, isAdmin, isSuperAdmin, siteName = '酒馆战棋联赛',
    webVersion = '0.1.0', extraHead = '', archived = false,
  } = props;

  return html`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title || siteName}</title>
    <link rel="icon" type="image/png" sizes="16x16" href="/public/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/public/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="/public/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/public/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/public/android-chrome-192x192.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
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
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
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
        @media (max-width: 1023px) { .hide-lg { display: none !important; } }
    </style>
    ${extraHead ? html`${extraHead}` : ''}
</head>
<body class="hearth-gradient min-h-screen text-gray-200">
    ${!archived ? html`
    <nav class="border-b border-hearth-border bg-black/30 backdrop-blur">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="text-xl font-bold text-hearth-gold flex items-center gap-2">
                <img src="/public/favicon-32x32.png" alt="logo" class="w-7 h-7 inline-block"> ${siteName}
            </a>
            <div class="hidden md:flex items-center gap-4 text-sm">
                <span data-nav-active-count class="active-pulse text-green-400">● ${activeCount} 场对局进行中</span>
                <span class="text-hearth-dim">|</span>
                <span class="text-hearth-dim">${playerCount} 名注册选手</span>
                <span class="text-hearth-dim">|</span>
                <a href="/leaderboard" class="text-hearth-dim hover:text-hearth-gold transition">排行榜</a>
                <span class="text-hearth-dim">|</span>
                <a href="/enroll" class="text-hearth-dim hover:text-hearth-gold transition">报名</a>
                <span class="text-hearth-dim">|</span>
                ${currentUser ? html`
                <a href="/player/${encodeURIComponent(currentUser.battleTag)}" class="text-hearth-gold font-medium hover:text-hearth-accent transition">${currentUser.displayName || currentUser.battleTag}</a>
                ${isAdmin ? html`<a href="/admin" class="text-hearth-dim hover:text-hearth-gold transition text-xs" title="管理面板">⚙️</a>` : ''}
                <button onclick="logout()" class="text-hearth-dim hover:text-red-400 transition text-xs">退出</button>
                ` : html`
                <a href="/register" class="text-hearth-gold hover:text-hearth-accent transition">登录</a>
                `}
            </div>
            <button id="mobileMenuBtn" onclick="toggleMobileMenu()" class="md:hidden text-hearth-dim hover:text-hearth-gold transition p-1">
                <svg id="menuIcon" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                <svg id="closeIcon" class="w-6 h-6 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <div id="mobileMenu" class="hidden md:hidden border-t border-hearth-border bg-black/50 backdrop-blur">
            <div class="px-4 py-3 space-y-3 text-sm">
                <div class="flex items-center gap-3 text-hearth-dim">
                    <span data-nav-active-count-mobile class="active-pulse text-green-400">● ${activeCount} 场对局进行中</span>
                    <span>${playerCount} 名注册选手</span>
                </div>
                <div class="flex flex-col gap-1">
                    <a href="/leaderboard" class="py-2 px-3 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">🏆 排行榜</a>
                    <a href="/enroll" class="py-2 px-3 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">📝 报名</a>
                </div>
                <div class="border-t border-hearth-border pt-3">
                    ${currentUser ? html`
                    <div class="flex items-center justify-between px-3">
                        <a href="/player/${encodeURIComponent(currentUser.battleTag)}" class="text-hearth-gold font-medium hover:text-hearth-accent transition">${currentUser.displayName || currentUser.battleTag}</a>
                        <div class="flex items-center gap-3">
                            <button onclick="logout()" class="text-hearth-dim hover:text-red-400 transition">退出</button>
                        </div>
                    </div>
                    ${isAdmin ? html`
                    <a href="/admin" class="block py-2 px-3 mt-1 rounded-lg text-hearth-dim hover:text-hearth-gold hover:bg-white/5 transition">⚙️ 管理面板</a>
                    ` : ''}
                    ` : html`
                    <a href="/register" class="block py-2 px-3 text-hearth-gold hover:text-hearth-accent transition">登录 / 注册</a>
                    `}
                </div>
            </div>
        </div>
    </nav>
    ` : ''}
    <main class="max-w-[1440px] mx-auto px-4 py-6">
        ${children}
    </main>
    <footer class="text-center py-4 text-xs text-hearth-dim/50">
        ${siteName} v${webVersion}
    </footer>
    <script>
    function toggleMobileMenu() {
        const menu = document.getElementById('mobileMenu');
        const menuIcon = document.getElementById('menuIcon');
        const closeIcon = document.getElementById('closeIcon');
        if (!menu) return;
        menu.classList.toggle('hidden');
        menuIcon.classList.toggle('hidden');
        closeIcon.classList.toggle('hidden');
    }
    document.getElementById('mobileMenu')?.addEventListener('click', function(e) {
        if (e.target.closest('a') || e.target.closest('button[onclick="logout()"]')) {
            toggleMobileMenu();
        }
    });
    async function logout() {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    }
    window.updateNavCount = function(count) {
        document.querySelectorAll('[data-nav-active-count], [data-nav-active-count-mobile]').forEach(function(el) {
            el.textContent = '\\u25cf ' + count + ' 场对局进行中';
        });
    };
    </script>

    <div id="confirmModal" class="fixed inset-0 z-[9999] hidden items-center justify-center">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="confirmOverlay"></div>
        <div class="relative bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl shadow-2xl max-w-md w-[90%] mx-4 p-6">
            <p id="confirmMsg" class="text-gray-200 text-sm leading-relaxed whitespace-pre-line"></p>
            <div class="flex justify-end gap-3 mt-5">
                <button id="confirmCancel" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#2a2a4a] hover:border-[#4a4a6a] rounded-lg transition">取消</button>
                <button id="confirmOk" class="px-4 py-2 text-sm text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition font-medium">确定</button>
            </div>
        </div>
    </div>
    <script>
    function showConfirm(msg) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const msgEl = document.getElementById('confirmMsg');
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');
            const overlay = document.getElementById('confirmOverlay');
            msgEl.textContent = msg;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            function close(result) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                overlay.onclick = null;
                document.onkeydown = null;
                resolve(result);
            }
            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            overlay.onclick = () => close(false);
            document.onkeydown = e => { if (e.key === 'Escape') close(false); };
        });
    }
    function showConfirmHTML(html, okLabel) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const msgEl = document.getElementById('confirmMsg');
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');
            const overlay = document.getElementById('confirmOverlay');
            msgEl.innerHTML = html;
            if (okLabel) okBtn.textContent = okLabel;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            function close(result) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                overlay.onclick = null;
                document.onkeydown = null;
                okBtn.textContent = '确定';
                resolve(result);
            }
            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            overlay.onclick = () => close(false);
            document.onkeydown = e => { if (e.key === 'Escape') close(false); };
        });
    }
    function showAlert(msg, opts = {}) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const msgEl = document.getElementById('confirmMsg');
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');
            const overlay = document.getElementById('confirmOverlay');
            msgEl.textContent = msg;
            cancelBtn.classList.add('hidden');
            okBtn.textContent = opts.okLabel || '确定';
            if (opts.okClass) okBtn.className = opts.okClass;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            function close() {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                okBtn.onclick = null;
                overlay.onclick = null;
                document.onkeydown = null;
                cancelBtn.classList.remove('hidden');
                okBtn.textContent = '确定';
                okBtn.className = 'px-4 py-2 text-sm text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition font-medium';
                resolve();
            }
            okBtn.onclick = close;
            overlay.onclick = close;
            document.onkeydown = e => { if (e.key === 'Escape' || e.key === 'Enter') close(); };
        });
    }
    </script>
</body>
</html>`;
}
