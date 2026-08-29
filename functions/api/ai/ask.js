import { requireStudent } from '../../_lib/auth.js';
import { callGemini, buildStudentContext } from '../../_lib/ai.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { message } = await readJson(request);
  if (!message) return error('message مطلوب', 400);

  let reply;
  try {
    const context = await buildStudentContext(env, student);
    reply = await callGemini(env, context, message);
  } catch (e) {
    return error(e.message, 500);
  }

  await env.DB.batch([
    env.DB.prepare('INSERT INTO ai_conversations (email, role, message) VALUES (?, ?, ?)').bind(student.email, 'user', message),
    env.DB.prepare('INSERT INTO ai_conversations (email, role, message) VALUES (?, ?, ?)').bind(student.email, 'assistant', reply)
  ]);

  return json({ ok: true, reply });
}
