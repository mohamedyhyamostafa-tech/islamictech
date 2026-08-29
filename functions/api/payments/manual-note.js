import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

// body: { orderId, note }  — note: رقم عملية التحويل أو أي تفاصيل يكتبها الطالب
export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { orderId, note } = await readJson(request);
  if (!orderId || !note) return error('orderId و note مطلوبين', 400);

  const order = await env.DB.prepare('SELECT * FROM purchases WHERE id = ? AND email = ?')
    .bind(orderId, student.email).first();
  if (!order) return error('الطلب غير موجود', 404);
  if (order.status !== 'pending') return error('الطلب ده اتراجع خلاص', 400);

  await env.DB.prepare('UPDATE purchases SET manual_note = ? WHERE id = ?').bind(note, orderId).run();
  return json({ ok: true, message: 'تم إرسال إثبات الدفع، هيتراجع من الأدمن قريبًا.' });
}
