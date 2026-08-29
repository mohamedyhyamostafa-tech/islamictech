import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// GET /api/quizzes?lessonId=xxx
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const lessonId = url.searchParams.get('lessonId');
  if (!lessonId) return error('lessonId مطلوب', 400);

  const quiz = await env.DB.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').bind(lessonId).first();
  if (!quiz) return json({ ok: true, quiz: null });

  const questions = await env.DB.prepare(
    'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index'
  ).bind(quiz.id).all();

  return json({
    ok: true,
    quiz: {
      quizId: quiz.id, title: quiz.title, passingScore: quiz.passing_score,
      questions: questions.results.map((q) => ({
        questionId: q.id, text: q.question_text, type: q.type,
        options: JSON.parse(q.options_json || '[]'), points: q.points
      }))
    }
  });
}

// POST /api/quizzes → إنشاء/تعديل كويز (أدمن)
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const q = await readJson(request);
  const id = q.quizId || newId('quiz');
  const existing = q.quizId ? await env.DB.prepare('SELECT id FROM quizzes WHERE id=?').bind(id).first() : null;

  if (existing) {
    await env.DB.prepare('UPDATE quizzes SET lesson_id=?, title=?, passing_score=? WHERE id=?')
      .bind(q.lessonId, q.title, q.passingScore || 60, id).run();
  } else {
    await env.DB.prepare('INSERT INTO quizzes (id, lesson_id, title, passing_score) VALUES (?,?,?,?)')
      .bind(id, q.lessonId, q.title, q.passingScore || 60).run();
  }
  return json({ ok: true, quizId: id });
}
