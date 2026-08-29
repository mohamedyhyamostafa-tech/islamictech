import { json, error, readJson } from '../../_lib/response.js';

// فورى بتنادي الـ endpoint ده تلقائيًا بعد ما العميل يدفع (Server Notification).
// راجع توثيق فورى لشكل الـ payload بالظبط وحدّث أسماء الحقول لو اختلفت.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const { merchantRefNum: orderId, fawryRefNumber, paymentStatus, messageSignature } = body;
  if (!orderId) return error('orderId مفقود', 400);

  const settings = await env.DB.prepare(
    `SELECT key, value FROM payment_settings WHERE key IN ('fawry_merchant_code','fawry_security_key')`
  ).all();
  const s = {};
  settings.results.forEach((r) => { s[r.key] = r.value; });

  const expectedSig = await sha256Hex(
    s.fawry_merchant_code + orderId + (fawryRefNumber || '') + (paymentStatus || '') + s.fawry_security_key
  );
  if (messageSignature && messageSignature !== expectedSig) {
    return error('توقيع غير صحيح — الطلب مرفوض', 401);
  }

  const order = await env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(orderId).first();
  if (!order) return error('الطلب غير موجود', 404);

  if (paymentStatus === 'PAID') {
    await env.DB.prepare(
      `UPDATE purchases SET status='confirmed', fawry_ref=?, confirmed_at=datetime('now') WHERE id=?`
    ).bind(fawryRefNumber || '', orderId).run();
  } else if (['FAILED', 'CANCELED', 'EXPIRED'].includes(paymentStatus)) {
    await env.DB.prepare(`UPDATE purchases SET status='rejected' WHERE id=?`).bind(orderId).run();
  }

  return json({ ok: true });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
