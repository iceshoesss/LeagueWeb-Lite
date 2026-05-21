import { Context, Next } from 'hono';
import { parseSession, COOKIE_NAME, Session } from './auth';

type Env = {
  Bindings: { DB: D1Database; SESSION_SECRET: string; SITE_NAME: string; WEB_VERSION: string };
  Variables: { user: Session | null; isAdmin: boolean; isSuperAdmin: boolean };
};

export async function authMiddleware(c: Context<Env>, next: Next) {
  const secret = c.env.SESSION_SECRET;
  const cookie = c.req.header('Cookie')?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
  const session = cookie ? await parseSession(secret, decodeURIComponent(cookie)) : null;
  c.set('user', session);

  if (session) {
    const admin = await c.env.DB.prepare(
      'SELECT is_super_admin FROM league_admins WHERE battle_tag = ?'
    ).bind(session.battleTag).first<{ is_super_admin: number }>();
    c.set('isAdmin', !!admin);
    c.set('isSuperAdmin', !!admin?.is_super_admin);
  } else {
    c.set('isAdmin', false);
    c.set('isSuperAdmin', false);
  }

  await next();
}

export function requireLogin(c: Context<Env>, next: Next) {
  if (!c.get('user')) {
    return c.redirect('/register');
  }
  return next();
}

export function requireAdmin(c: Context<Env>, next: Next) {
  if (!c.get('isAdmin')) {
    return c.text('Forbidden', 403);
  }
  return next();
}
