import { requireAdmin } from '../../_lib/auth.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const [students, courses, attempts, purchases] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) c FROM students').first(),
    env.DB.prepare('SELECT COUNT(*) c, SUM(is_published) pub FROM courses').first(),
    env.DB.prepare('SELECT COUNT(*) c, AVG(percentage) avg_score FROM attempts').first(),
    env.DB.prepare(`SELECT COUNT(*) c, SUM(amount_cents) total FROM purchases WHERE status='confirmed'`).first()
  ]);

  return json({
    ok: true,
    totalStudents: students.c,
    totalCourses: courses.c,
    publishedCourses: courses.pub || 0,
    totalQuizAttempts: attempts.c,
    avgQuizScore: Math.round(attempts.avg_score || 0),
    totalRevenueEGP: (purchases.total || 0) / 100,
    totalConfirmedPurchases: purchases.c
  });
}
