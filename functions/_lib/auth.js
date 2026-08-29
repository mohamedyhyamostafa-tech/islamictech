// ============================================================
// ISLAMIC TECH — auth.js
// جلسة الموقع: JWT (HS256) موقّع بسر SESSION_SECRET، متخزن في كوكي httpOnly.
// تسجيل الدخول: Google Identity Services من الفرونت يبعت ID Token،
// وإحنا هنا نتحقق من توقيعه بمفاتيح جوجل العامة (JWKS) قبل ما نصدّقه.
// ============================================================

function b64urlEncode(bytes) {
  let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export async function signSession(payload, secret, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const encHeader = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encBody = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)));
  const data = encHeader + '.' + encBody;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + b64urlEncode(sig);
}

export async function verifySession(token, secret) {
  try {
    const [encHeader, encBody, encSig] = token.split('.');
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC', key, b64urlDecode(encSig),
      new TextEncoder().encode(encHeader + '.' + encBody)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(encBody)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token) {
  return `it_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearCookieHeader() {
  return 'it_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

// ---- التحقق من Google ID Token (بدون مكتبات خارجية) ----
let cachedJwks = null, cachedAt = 0;

async function getGoogleJwks() {
  if (cachedJwks && Date.now() - cachedAt < 6 * 60 * 60 * 1000) return cachedJwks;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  cachedJwks = await res.json();
  cachedAt = Date.now();
  return cachedJwks;
}

export async function verifyGoogleIdToken(idToken, expectedClientId) {
  const [encHeader, encBody, encSig] = idToken.split('.');
  if (!encHeader || !encBody || !encSig) throw new Error('توكن جوجل غير صالح');

  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(encHeader)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(encBody)));

  const jwks = await getGoogleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('مفتاح توقيع جوجل غير معروف');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey, b64urlDecode(encSig),
    new TextEncoder().encode(encHeader + '.' + encBody)
  );
  if (!valid) throw new Error('توقيع توكن جوجل غير صحيح');

  if (payload.aud !== expectedClientId) throw new Error('التوكن ده لمشروع جوجل تاني');
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('مصدر التوكن غير موثوق');
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('توكن جوجل منتهي');
  if (!payload.email_verified) throw new Error('إيميل جوجل غير موثّق');

  return { email: payload.email, name: payload.name || payload.email.split('@')[0] };
}

// ---- جلب المستخدم الحالي من الكوكي + قاعدة البيانات ----
export async function getCurrentStudent(request, env) {
  const token = getCookie(request, 'it_session');
  if (!token) return null;
  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload || !payload.email) return null;

  const row = await env.DB.prepare('SELECT * FROM students WHERE email = ?')
    .bind(payload.email).first();
  return row || null;
}

export async function requireStudent(request, env) {
  const student = await getCurrentStudent(request, env);
  if (!student) {
    const e = new Error('لازم تسجّل دخول أولاً');
    e.status = 401;
    throw e;
  }
  if (student.role === 'banned') {
    const e = new Error('حسابك محظور من المنصة');
    e.status = 403;
    throw e;
  }
  return student;
}

export async function requireAdmin(request, env) {
  const student = await requireStudent(request, env);
  if (student.role !== 'admin') {
    const e = new Error('الصفحة دي للأدمن بس');
    e.status = 403;
    throw e;
  }
  return student;
}
