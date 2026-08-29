import { requireAdmin, requireStudent } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM challenges WHERE date('now') BETWEEN date(start_date) AND date(end_date)`
  ).all();
  return json({ ok: true, challenges: rows.results });
}

export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const c = await readJson(request);
  const id = c.challengeId || newId('chal');
  const existing = c.challengeId ? await env.DB.prepare('SELECT id FROM challenges WHERE id=?').bind(id).first() : null;

  if (existing) {
    await env.DB.prepare(
      `UPDATE challenges SET title=?, description=?, type=?, points=?, start_date=?, end_date=? WHERE id=?`
    ).bind(c.title, c.description || '', c.type || '', c.points || 0, c.startDate, c.endDate, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO challenges (id, title, description, type, points, start_date, end_date) VALUES (?,?,?,?,?,?,?)`
    ).bind(id, c.title, c.description || '', c.type || '', c.points || 0, c.startDate, c.endDate).run();
  }
  return json({ ok: true, challengeId: id });
}
