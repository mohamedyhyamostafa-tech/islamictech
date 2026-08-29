import { getCurrentStudent, requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// GET /api/courses  → قائمة الكورسات المنشورة + دروسها (بدون كشف رابط الفيديو المباشر لو مقفول)
export async function onRequestGet({ request, env }) {
  const student = await getCurrentStudent(request, env);

  const courses = await env.DB.prepare(
    'SELECT * FROM courses WHERE is_published = 1 ORDER BY created_at DESC'
  ).all();

  let purchasedCourseIds = new Set();
  if (student) {
    const purchases = await env.DB.prepare(
      `SELECT item_id FROM purchases WHERE email = ? AND item_type = 'course' AND status = 'confirmed'`
    ).bind(student.email).all();
    purchasedCourseIds = new Set(purchases.results.map((p) => p.item_id));
  }

  const result = [];
  for (const c of courses.results) {
    const unlocked = !!c.is_free || (student && student.role === 'admin') || purchasedCourseIds.has(c.id);
    const lessons = await env.DB.prepare(
      'SELECT id, title, duration_min, order_index, video_source FROM lessons WHERE course_id = ? ORDER BY order_index'
    ).bind(c.id).all();

    result.push({
      courseId: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      track: c.track,
      level: c.level,
      coverUrl: c.cover_url,
      isFree: !!c.is_free,
      priceCents: c.price_cents,
      unlocked,
      lessons: lessons.results.map((l) => ({
        lessonId: l.id,
        title: l.title,
        durationMin: l.duration_min,
        // لو مقفول: مبعتش أي مرجع فيديو للفرونت خالص، الفتح بيتم عبر رابط موقّت بعد التحقق من الشراء
        videoSource: unlocked ? l.video_source : null
      }))
    });
  }

  return json({ ok: true, courses: result });
}

// POST /api/courses  → إنشاء/تعديل كورس (أدمن بس)
export async function onRequestPost({ request, env }) {
  let admin;
  try { admin = await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const c = await readJson(request);
  const id = c.courseId || newId('course');
  const existing = c.courseId
    ? await env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(id).first()
    : null;

  if (existing) {
    await env.DB.prepare(
      `UPDATE courses SET title=?, description=?, category=?, track=?, level=?,
       is_published=?, is_free=?, price_cents=?, cover_url=? WHERE id=?`
    ).bind(
      c.title, c.description || '', c.category || '', c.track || '', c.level || '',
      c.isPublished ? 1 : 0, c.isFree ? 1 : 0, c.priceCents || 0, c.coverUrl || '', id
    ).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO courses (id, title, description, category, track, level, is_published, is_free, price_cents, cover_url)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, c.title, c.description || '', c.category || '', c.track || '', c.level || '',
      c.isPublished ? 1 : 0, c.isFree === false ? 0 : 1, c.priceCents || 0, c.coverUrl || ''
    ).run();
  }

  return json({ ok: true, courseId: id });
}
