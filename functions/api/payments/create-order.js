import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson, newId } from '../../_lib/response.js';

// body: { itemType: 'course'|'book'|'video', itemId, customerMobile? }
export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { itemType, itemId, customerMobile } = await readJson(request);
  if (!itemType || !itemId) return error('itemType و itemId مطلوبين', 400);

  const item = await getItem(env, itemType, itemId);
  if (!item) return error('العنصر غير موجود', 404);
  if (item.is_free) return json({ ok: true, alreadyFree: true });

  const already = await env.DB.prepare(
    `SELECT id FROM purchases WHERE email=? AND item_type=? AND item_id=? AND status='confirmed'`
  ).bind(student.email, itemType, itemId).first();
  if (already) return json({ ok: true, alreadyPurchased: true });

  const settings = await getSettings(env);
  const orderId = newId('order');

  await env.DB.prepare(
    `INSERT INTO purchases (id, email, item_type, item_id, amount_cents, method, status)
     VALUES (?,?,?,?,?,?, 'pending')`
  ).bind(orderId, student.email, itemType, itemId, item.price_cents, settings.active_method).run();

  if (settings.active_method === 'fawry') {
    if (!settings.fawry_merchant_code || !settings.fawry_security_key) {
      return error('بوابة فورى لسه مش متظبطة من الأدمن. جرّب التحويل اليدوي.', 400);
    }
    const charge = await buildFawryCharge(env, settings, {
      orderId, amount: item.price_cents / 100, email: student.email,
      customerMobile: customerMobile || '01000000000', description: item.title
    });
    return json({ ok: true, method: 'fawry', orderId, fawry: charge });
  }

  // تحويل يدوي
  return json({
    ok: true, method: 'manual', orderId,
    amountEGP: item.price_cents / 100,
    manualChannel: settings.manual_channel,
    manualContact: settings.manual_contact,
    instructions: manualInstructions(settings.manual_channel, settings.manual_contact, item.price_cents / 100, orderId)
  });
}

async function getItem(env, itemType, itemId) {
  const table = { course: 'courses', book: 'books', video: 'standalone_videos' }[itemType];
  if (!table) return null;
  return env.DB.prepare(`SELECT id, title, is_free, price_cents FROM ${table} WHERE id = ?`).bind(itemId).first();
}

async function getSettings(env) {
  const rows = await env.DB.prepare('SELECT key, value FROM payment_settings').all();
  const s = {};
  rows.results.forEach((r) => { s[r.key] = r.value; });
  return s;
}

function manualInstructions(channel, contact, amountEGP, orderId) {
  const base = `حوّل ${amountEGP} جنيه وابعت صورة التحويل/رقم العملية مع كود الطلب ${orderId}`;
  if (channel === 'vodafone_cash') return `${base} على رقم فودافون كاش: ${contact}`;
  if (channel === 'whatsapp') return `${base} على واتساب: ${contact}`;
  if (channel === 'telegram') return `${base} على تليجرام: ${contact}`;
  return base;
}

// ---- Fawry Pay Charge Request ----
// التوقيع حسب توثيق فورى الرسمي (Fawry Pay API) — راجع developer.fawrystaging.com
// لو فورى غيّروا شكل التوقيع، عدّل الدالة دي بس مش باقي النظام.
async function buildFawryCharge(env, settings, { orderId, amount, email, customerMobile, description }) {
  const merchantCode = settings.fawry_merchant_code;
  const securityKey = settings.fawry_security_key;
  const amountStr = amount.toFixed(2);

  const signatureRaw = merchantCode + orderId + amountStr + securityKey;
  const signature = await sha256Hex(signatureRaw);

  return {
    merchantCode,
    merchantRefNum: orderId,
    customerMobile,
    customerEmail: email,
    paymentExpiry: Date.now() + 1000 * 60 * 60,
    chargeItems: [{ itemId: orderId, description, price: amountStr, quantity: '1' }],
    amount: amountStr,
    currencyCode: 'EGP',
    paymentMethod: 'PayAtFawry',
    signature,
    note: 'ابعت الطلب ده لـ FawryPay Charge Request API من السيرفر مباشرة (مش من الفرونت) عشان الـ securityKey متتكشفش.'
  };
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
