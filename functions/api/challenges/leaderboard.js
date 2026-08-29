import { json } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 100);
  const rows = await env.DB.prepare(
    'SELECT full_name, points, track FROM students ORDER BY points DESC LIMIT ?'
  ).bind(limit).all();
  return json({ ok: true, leaderboard: rows.results });
}
