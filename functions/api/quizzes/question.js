import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const q = await readJson(request);
  if (!q.quizId || !q.text || q.correctAnswer === undefined) return error('بيانات ناقصة', 400);

  const id = q.questionId || newId('q');
  const existing = q.questionId ? await env.DB.prepare('SELECT id FROM questions WHERE id=?').bind(id).first() : null;
  const optionsJson = JSON.stringify(q.options || []);

  if (existing) {
    await env.DB.prepare(
      `UPDATE questions SET quiz_id=?, question_text=?, type=?, options_json=?, correct_answer=?, points=?, order_index=? WHERE id=?`
    ).bind(q.quizId, q.text, q.type || 'mcq', optionsJson, q.correctAnswer, q.points || 1, q.orderIndex || 0, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO questions (id, quiz_id, question_text, type, options_json, correct_answer, points, order_index)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(id, q.quizId, q.text, q.type || 'mcq', optionsJson, q.correctAnswer, q.points || 1, q.orderIndex || 0).run();
  }
  return json({ ok: true, questionId: id });
}
