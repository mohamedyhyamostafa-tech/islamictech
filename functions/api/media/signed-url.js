import { requireStudent } from '../../_lib/auth.js';
import { json, error, readJson } from '../../_lib/response.js';

// ============================================================
// ملاحظة أمانة مهمة: مفيش تقنية ويب تقدر تمنع تصوير الشاشة بشكل مطلق.
// اللي بنعمله هنا هو ردع حقيقي، مش قفل نهائي:
//  - رابط الفيديو مبيتكشفش في الصفحة إلا بعد التحقق من إن الطالب دخل دخوله
//    وعنده صلاحية (مجاني/مشترك)، وليه صلاحية قصيرة تنتهي بعد دقايق.
//  - بيرجع بيانات watermark (اسم/إيميل الطالب) عشان الفرونت يحطها overlay
//    فوق الفيديو، فلو حد صوّر الشاشة يفضل اسمه ظاهر في التسجيل.
//  - لو الفيديو على Cloudflare Stream، بنولّد Signed Token حقيقي
//    (JWT موقّع بمفتاح Stream) بيمنع فتح الفيديو من رابط عام تاني.
// ============================================================

export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const { itemType, itemId } = await readJson(request);
  if (!itemType || !itemId) return error('itemType و itemId مطلوبين', 400);

  const access = await checkAccess(env, student, itemType, itemId);
  if (!access.allowed) return error(access.reason || 'مفيش صلاحية لعرض المحتوى ده', 403);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 دقايق
  const token = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO media_access_tokens (token, email, item_type, item_id, expires_at) VALUES (?,?,?,?,?)`
  ).bind(token, student.email, itemType, itemId, expiresAt).run();

  const watermark = { name: student.full_name, email: student.email, ts: Date.now() };

  if (access.videoSource === 'stream') {
    const streamToken = await signStreamToken(env, access.videoRef);
    return json({
      ok: true, source: 'stream', playbackUrl: `https://customer-${env.STREAM_CUSTOMER_CODE}.cloudflarestream.com/${streamToken}/iframe`,
      expiresAt, watermark
    });
  }

  if (itemType === 'book') {
    return json({ ok: true, source: 'book', downloadUrl: `/api/media/download-book?token=${token}`, expiresAt, watermark });
  }

  // يوتيوب/درايف/فيسبوك/رابط خارجي: أقصى حماية ممكنة هي إخفاء الرابط لحد التحقق،
  // + تحديد نطاق العرض من إعدادات المصدر نفسه (قيّد embed على دومين موقعك من يوتيوب/درايف).
  return json({
    ok: true, source: access.videoSource, ref: access.videoRef,
    expiresAt, watermark
  });
}

async function checkAccess(env, student, itemType, itemId) {
  if (student.role === 'admin') {
    const ref = await getVideoRef(env, itemType, itemId);
    return { allowed: true, ...ref };
  }

  if (itemType === 'lesson') {
    const lesson = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(itemId).first();
    if (!lesson) return { allowed: false, reason: 'الدرس غير موجود' };
    const course = await env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(lesson.course_id).first();
    if (course.is_free) return { allowed: true, videoSource: lesson.video_source, videoRef: lesson.video_ref };
    const purchased = await hasPurchase(env, student.email, 'course', course.id);
    if (!purchased) return { allowed: false, reason: 'الكورس ده مدفوع ولسه مش مشترك فيه' };
    return { allowed: true, videoSource: lesson.video_source, videoRef: lesson.video_ref };
  }

  if (itemType === 'book') {
    const book = await env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(itemId).first();
    if (!book) return { allowed: false, reason: 'الكتاب غير موجود' };
    if (book.is_free) return { allowed: true, videoSource: 'book', videoRef: book.file_key };
    const purchased = await hasPurchase(env, student.email, 'book', book.id);
    if (!purchased) return { allowed: false, reason: 'الكتاب ده مدفوع ولسه مش مشترك فيه' };
    return { allowed: true, videoSource: 'book', videoRef: book.file_key };
  }

  if (itemType === 'video') {
    const video = await env.DB.prepare('SELECT * FROM standalone_videos WHERE id = ?').bind(itemId).first();
    if (!video) return { allowed: false, reason: 'الفيديو غير موجود' };
    if (video.is_free) return { allowed: true, videoSource: video.video_source, videoRef: video.video_ref };
    const purchased = await hasPurchase(env, student.email, 'video', video.id);
    if (!purchased) return { allowed: false, reason: 'الفيديو ده مدفوع ولسه مش مشترك فيه' };
    return { allowed: true, videoSource: video.video_source, videoRef: video.video_ref };
  }

  return { allowed: false, reason: 'نوع محتوى غير معروف' };
}

async function getVideoRef(env, itemType, itemId) {
  if (itemType === 'lesson') {
    const l = await env.DB.prepare('SELECT video_source, video_ref FROM lessons WHERE id = ?').bind(itemId).first();
    return { videoSource: l.video_source, videoRef: l.video_ref };
  }
  const v = await env.DB.prepare('SELECT video_source, video_ref FROM standalone_videos WHERE id = ?').bind(itemId).first();
  return { videoSource: v.video_source, videoRef: v.video_ref };
}

async function hasPurchase(env, email, itemType, itemId) {
  const row = await env.DB.prepare(
    `SELECT id FROM purchases WHERE email=? AND item_type=? AND item_id=? AND status='confirmed'`
  ).bind(email, itemType, itemId).first();
  return !!row;
}

// ---- توليد Cloudflare Stream Signed Token (JWT RS256) ----
// محتاج STREAM_SIGNING_KEY_ID و STREAM_SIGNING_KEY_PEM (PKCS8) من تبويب
// Stream → Signed URL Tokens في لوحة Cloudflare (خدمة مدفوعة بشكل منفصل).
async function signStreamToken(env, videoUid) {
  const header = { alg: 'RS256', kid: env.STREAM_SIGNING_KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: videoUid, exp: now + 600, nbf: now - 5 };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const data = enc(header) + '.' + enc(payload);

  const pemBody = env.STREAM_SIGNING_KEY_PEM
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  const encSig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return data + '.' + encSig;
}
