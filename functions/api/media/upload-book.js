import { requireAdmin } from '../../_lib/auth.js';
import { json, error, newId } from '../../_lib/response.js';

// POST /api/media/upload-book  (multipart/form-data, field name: file) — أدمن بس
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return error('لازم ترفع ملف PDF', 400);
  if (file.type !== 'application/pdf') return error('الملفات المسموحة PDF بس', 400);

  const key = 'books/' + newId('file') + '.pdf';
  await env.BOOKS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: 'application/pdf' }
  });

  return json({ ok: true, fileKey: key });
}
