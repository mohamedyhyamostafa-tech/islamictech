import { getCurrentStudent, requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  const student = await getCurrentStudent(request, env);
  const videos = await env.DB.prepare(
    'SELECT * FROM standalone_videos WHERE is_published = 1 ORDER BY created_at DESC'
  ).all();

  let purchased = new Set();
  if (student) {
    const rows = await env.DB.prepare(
      `SELECT item_id FROM purchases WHERE email=? AND item_type='video' AND status='confirmed'`
    ).bind(student.email).all();
    purchased = new Set(rows.results.map((r) => r.item_id));
  }

  return json({
    ok: true,
    videos: videos.results.map((v) => ({
      videoId: v.id, title: v.title, description: v.description, category: v.category,
      isFree: !!v.is_free, priceCents: v.price_cents,
      unlocked: !!v.is_free || (student && student.role === 'admin') || purchased.has(v.id)
    }))
  });
}

export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const v = await readJson(request);
  if (!v.title || !v.videoRef) return error('title و videoRef مطلوبين', 400);
  const id = v.videoId || newId('vid');
  const existing = v.videoId ? await env.DB.prepare('SELECT id FROM standalone_videos WHERE id=?').bind(id).first() : null;

  if (existing) {
    await env.DB.prepare(
      `UPDATE standalone_videos SET title=?, description=?, category=?, video_source=?, video_ref=?, is_free=?, price_cents=?, is_published=? WHERE id=?`
    ).bind(v.title, v.description || '', v.category || '', v.videoSource || 'youtube', v.videoRef, v.isFree ? 1 : 0, v.priceCents || 0, v.isPublished === false ? 0 : 1, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO standalone_videos (id, title, description, category, video_source, video_ref, is_free, price_cents, is_published)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(id, v.title, v.description || '', v.category || '', v.videoSource || 'youtube', v.videoRef, v.isFree === false ? 0 : 1, v.priceCents || 0, v.isPublished === false ? 0 : 1).run();
  }

  return json({ ok: true, videoId: id });
}
