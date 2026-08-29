import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

// GET → كل الطلبات المعلّقة (تحويل يدوي محتاج مراجعة الأدمن)
export async function onRequestGet({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const rows = await env.DB.prepare(
    `SELECT * FROM purchases WHERE method = 'manual' AND status = 'pending' ORDER BY created_at DESC`
  ).all();
  return json({ ok: true, orders: rows.results });
}

// POST body: { orderId, action: 'confirm'|'reject' }
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const { orderId, action } = await readJson(request);
  if (!orderId || !['confirm', 'reject'].includes(action)) return error('بيانات غير صحيحة', 400);

  const status = action === 'confirm' ? 'confirmed' : 'rejected';
  await env.DB.prepare(
    `UPDATE purchases SET status = ?, confirmed_at = datetime('now') WHERE id = ?`
  ).bind(status, orderId).run();

  return json({ ok: true });
}
