import { error } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return error('token مطلوب', 400);

  const row = await env.DB.prepare(
    `SELECT * FROM media_access_tokens WHERE token = ? AND item_type = 'book'`
  ).bind(token).first();
  if (!row) return error('رابط غير صالح', 403);
  if (new Date(row.expires_at) < new Date()) return error('انتهت صلاحية الرابط، اطلب رابط جديد', 403);

  const book = await env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(row.item_id).first();
  if (!book) return error('الكتاب غير موجود', 404);

  const object = await env.BOOKS_BUCKET.get(book.file_key);
  if (!object) return error('الملف غير موجود في التخزين', 404);

  return new Response(object.body, {
    headers: {
      'content-type': 'application/pdf',
      // inline بدل attachment عشان يتفتح في viewer الموقع بدل ما ينزل مباشرة على الجهاز
      'content-disposition': `inline; filename="${book.title.replace(/[^\w\u0600-\u06FF ]/g, '')}.pdf"`,
      'cache-control': 'no-store'
    }
  });
}
