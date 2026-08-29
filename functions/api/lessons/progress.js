import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { lessonId, percent } = await readJson(request);
  if (!lessonId) return error('lessonId مطلوب', 400);
  const completed = (percent || 0) >= 90 ? 1 : 0;

  const existing = await env.DB.prepare(
    'SELECT * FROM progress WHERE email = ? AND lesson_id = ?'
  ).bind(student.email, lessonId).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE progress SET progress_percent=?, completed=?, completed_at=CASE WHEN ?=1 THEN datetime('now') ELSE completed_at END
       WHERE email=? AND lesson_id=?`
    ).bind(percent || 0, completed, completed, student.email, lessonId).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO progress (email, lesson_id, completed, progress_percent, completed_at)
       VALUES (?,?,?,?, CASE WHEN ?=1 THEN datetime('now') ELSE NULL END)`
    ).bind(student.email, lessonId, completed, percent || 0, completed).run();
  }

  if (completed && !(existing && existing.completed)) {
    await env.DB.prepare('UPDATE students SET points = points + 10 WHERE email = ?')
      .bind(student.email).run();
  }

  return json({ ok: true });
}
