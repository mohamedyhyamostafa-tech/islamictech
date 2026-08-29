import { verifyGoogleIdToken, signSession, sessionCookieHeader } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body.credential) return error('مفيش credential من جوجل', 400);

  let googleUser;
  try {
    googleUser = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID);
  } catch (e) {
    return error('فشل التحقق من حساب جوجل: ' + e.message, 401);
  }

  let student = await env.DB.prepare('SELECT * FROM students WHERE email = ?')
    .bind(googleUser.email).first();

  if (!student) {
    // أول أدمن للمنصة هو الإيميل المتخزن في ADMIN_EMAIL (متغيّر بيئة)
    const role = env.ADMIN_EMAIL && env.ADMIN_EMAIL.toLowerCase() === googleUser.email.toLowerCase()
      ? 'admin' : 'student';
    await env.DB.prepare(
      `INSERT INTO students (email, full_name, role) VALUES (?, ?, ?)`
    ).bind(googleUser.email, googleUser.name, role).run();
    student = await env.DB.prepare('SELECT * FROM students WHERE email = ?')
      .bind(googleUser.email).first();
  } else {
    await env.DB.prepare(`UPDATE students SET last_login = datetime('now') WHERE email = ?`)
      .bind(googleUser.email).run();
  }

  const token = await signSession({ email: student.email }, env.SESSION_SECRET);
  return new Response(JSON.stringify({ ok: true, role: student.role }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Set-Cookie': sessionCookieHeader(token)
    }
  });
}
