import { requireAdmin } from '../../_lib/auth.js';
import { callGemini, buildAdminContext } from '../../_lib/ai.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  let report;
  try {
    const context = await buildAdminContext(env);
    report = await callGemini(env, context, 'حلّل أداء المنصة دلوقتي واقترح خطوات تحسين عملية.');
  } catch (e) {
    return error(e.message, 500);
  }

  await env.DB.prepare('INSERT INTO ai_admin_reports (report_text) VALUES (?)').bind(report).run();
  return json({ ok: true, report });
}
