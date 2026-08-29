import { getCurrentStudent } from '../../_lib/auth.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  const student = await getCurrentStudent(request, env);
  if (!student) return error('مش مسجّل دخول', 401);
  return json({
    ok: true,
    email: student.email,
    fullName: student.full_name,
    role: student.role,
    track: student.track,
    level: student.level,
    points: student.points,
    streak: student.streak
  });
}
