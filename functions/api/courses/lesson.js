import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// POST /api/courses/lesson  → إضافة/تعديل درس (أدمن بس)
// body: { lessonId?, courseId, title, videoSource: 'youtube'|'drive'|'facebook'|'stream'|'external', videoRef, orderIndex, durationMin, content }
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const l = await readJson(request);
  if (!l.courseId || !l.title) return error('لازم courseId و title', 400);

  const id = l.lessonId || newId('lesson');
  const existing = l.lessonId
    ? await env.DB.prepare('SELECT id FROM lessons WHERE id = ?').bind(id).first()
    : null;

  if (existing) {
    await env.DB.prepare(
      `UPDATE lessons SET course_id=?, title=?, video_source=?, video_ref=?, order_index=?, duration_min=?, content=? WHERE id=?`
    ).bind(l.courseId, l.title, l.videoSource || 'youtube', l.videoRef || '', l.orderIndex || 0, l.durationMin || 0, l.content || '', id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO lessons (id, course_id, title, video_source, video_ref, order_index, duration_min, content)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(id, l.courseId, l.title, l.videoSource || 'youtube', l.videoRef || '', l.orderIndex || 0, l.durationMin || 0, l.content || '').run();
  }

  return json({ ok: true, lessonId: id });
}
