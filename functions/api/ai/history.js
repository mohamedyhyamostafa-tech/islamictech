import { requireStudent } from '../../_lib/auth.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const rows = await env.DB.prepare(
    'SELECT role, message, timestamp FROM ai_conversations WHERE email = ? ORDER BY timestamp ASC'
  ).bind(student.email).all();
  return json({ ok: true, history: rows.results });
}
