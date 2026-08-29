import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// body: { quizId, answers: { questionId: 'الإجابة' } }
export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { quizId, answers } = await readJson(request);
  if (!quizId || !answers) return error('quizId و answers مطلوبين', 400);

  const quiz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first();
  if (!quiz) return error('الكويز غير موجود', 404);

  const questions = await env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ?').bind(quizId).all();

  let score = 0, max = 0;
  for (const q of questions.results) {
    max += q.points;
    const given = String(answers[q.id] ?? '').trim();
    const correct = String(q.correct_answer ?? '').trim();
    if (given === correct) score += q.points; // مطابقة حساسة لحالة الأحرف
  }

  const percentage = max > 0 ? Math.round((score / max) * 100) : 0;
  const passed = percentage >= quiz.passing_score ? 1 : 0;
  const attemptId = newId('attempt');

  await env.DB.prepare(
    `INSERT INTO attempts (id, email, quiz_id, score, max_score, percentage, passed, answers_json)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(attemptId, student.email, quizId, score, max, percentage, passed, JSON.stringify(answers)).run();

  if (passed) {
    await env.DB.prepare('UPDATE students SET points = points + 20 WHERE email = ?').bind(student.email).run();
  }

  return json({ ok: true, score, max, percentage, passed: !!passed });
}
