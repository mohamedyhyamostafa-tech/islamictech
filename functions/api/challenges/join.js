import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { challengeId } = await readJson(request);
  if (!challengeId) return error('challengeId مطلوب', 400);

  const existing = await env.DB.prepare(
    'SELECT id FROM challenge_participants WHERE challenge_id = ? AND email = ?'
  ).bind(challengeId, student.email).first();
  if (existing) return json({ ok: true, alreadyJoined: true });

  await env.DB.prepare(
    'INSERT INTO challenge_participants (challenge_id, email) VALUES (?, ?)'
  ).bind(challengeId, student.email).run();
  return json({ ok: true });
}
