import { json } from '../_lib/response.js';

export async function onRequestGet({ env }) {
  // GOOGLE_CLIENT_ID مصمم أصلاً ليكون عام (مش سر) — ده جزء طبيعي من Google Sign-In
  return json({ ok: true, googleClientId: env.GOOGLE_CLIENT_ID || '' });
}
