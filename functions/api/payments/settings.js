import { requireAdmin } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const rows = await env.DB.prepare('SELECT key, value FROM payment_settings').all();
  const settings = {};
  rows.results.forEach((r) => { settings[r.key] = r.value; });
  return json({ ok: true, settings });
}

// body: { activeMethod: 'fawry'|'manual', manualChannel: 'vodafone_cash'|'whatsapp'|'telegram', manualContact, fawryMerchantCode, fawrySecurityKey }
export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const body = await readJson(request);
  const map = {
    active_method: body.activeMethod,
    manual_channel: body.manualChannel,
    manual_contact: body.manualContact,
    fawry_merchant_code: body.fawryMerchantCode,
    fawry_security_key: body.fawrySecurityKey
  };
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    await env.DB.prepare('INSERT INTO payment_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .bind(key, String(value)).run();
  }
  return json({ ok: true });
}
