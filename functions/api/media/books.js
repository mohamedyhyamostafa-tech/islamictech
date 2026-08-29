import { getCurrentStudent, requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// GET /api/media/books → كتالوج الكتب
export async function onRequestGet({ request, env }) {
  const student = await getCurrentStudent(request, env);
  const books = await env.DB.prepare(
    'SELECT * FROM books WHERE is_published = 1 ORDER BY created_at DESC'
  ).all();

  let purchased = new Set();
  if (student) {
    const rows = await env.DB.prepare(
      `SELECT item_id FROM purchases WHERE email=? AND item_type='book' AND status='confirmed'`
    ).bind(student.email).all();
    purchased = new Set(rows.results.map((r) => r.item_id));
  }

  return json({
    ok: true,
    books: books.results.map((b) => ({
      bookId: b.id, title: b.title, author: b.author, description: b.description,
      category: b.category, coverUrl: b.cover_url, isFree: !!b.is_free, priceCents: b.price_cents,
      unlocked: !!b.is_free || (student && student.role === 'admin') || purchased.has(b.id)
    }))
  });
}

// POST /api/media/books → إضافة/تعديل كتاب (أدمن) — file_key بيتحدد بعد رفع الملف على R2 عبر /api/media/upload-book
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const b = await readJson(request);
  if (!b.title || !b.fileKey) return error('title و fileKey مطلوبين', 400);
  const id = b.bookId || newId('book');
  const existing = b.bookId ? await env.DB.prepare('SELECT id FROM books WHERE id=?').bind(id).first() : null;

  if (existing) {
    await env.DB.prepare(
      `UPDATE books SET title=?, author=?, description=?, category=?, cover_url=?, file_key=?, is_free=?, price_cents=?, is_published=? WHERE id=?`
    ).bind(b.title, b.author || '', b.description || '', b.category || '', b.coverUrl || '', b.fileKey, b.isFree ? 1 : 0, b.priceCents || 0, b.isPublished === false ? 0 : 1, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO books (id, title, author, description, category, cover_url, file_key, is_free, price_cents, is_published)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, b.title, b.author || '', b.description || '', b.category || '', b.coverUrl || '', b.fileKey, b.isFree === false ? 0 : 1, b.priceCents || 0, b.isPublished === false ? 0 : 1).run();
  }

  return json({ ok: true, bookId: id });
}
