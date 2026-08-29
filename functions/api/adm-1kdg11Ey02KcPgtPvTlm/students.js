import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const rows = await env.DB.prepare(
    'SELECT email, full_name, role, track, level, points, streak, last_login FROM students ORDER BY joined_at DESC'
  ).all();
  return json({ ok: true, students: rows.results });
}

// body: { email, action: 'ban'|'unban'|'make_admin' }
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const { email, action } = await readJson(request);
  if (!email || !action) return error('بيانات ناقصة', 400);

  if (action === 'ban') {
    await env.DB.prepare(`UPDATE students SET role = 'banned' WHERE email = ?`).bind(email).run();
  } else if (action === 'unban') {
    await env.DB.prepare(`UPDATE students SET role = 'student' WHERE email = ?`).bind(email).run();
  } else if (action === 'make_admin') {
    await env.DB.prepare(`UPDATE students SET role = 'admin' WHERE email = ?`).bind(email).run();
  } else {
    return error('action غير معروف', 400);
  }
  return json({ ok: true });
}
