export async function callGemini(env, systemContext, userMessage) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('مفيش مفتاح Gemini متخزن (GEMINI_API_KEY).');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: systemContext + '\n\n---\n' + userMessage }] }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.candidates && data.candidates.length) {
    return data.candidates[0].content.parts[0].text;
  }
  return 'معلش، حصل خطأ في الاتصال بالمساعد الذكي. حاول تاني.';
}

export async function buildStudentContext(env, student) {
  const progress = await env.DB.prepare('SELECT completed FROM progress WHERE email = ?').bind(student.email).all();
  const attempts = await env.DB.prepare('SELECT percentage, passed FROM attempts WHERE email = ?').bind(student.email).all();

  const completedLessons = progress.results.filter((p) => p.completed).length;
  const avgScore = attempts.results.length
    ? Math.round(attempts.results.reduce((s, a) => s + a.percentage, 0) / attempts.results.length)
    : null;
  const weakCount = attempts.results.filter((a) => !a.passed).length;

  return [
    'أنت مساعد تعليمي إسلامي ذكي داخل منصة "اسلامك تك". خاطب الطالب بالعربية الفصحى المبسطة، بأسلوب محترم ومحفّز.',
    'بيانات الطالب الحالي:',
    `- الاسم: ${student.full_name}`,
    `- المسار: ${student.track || 'لم يُحدَّد بعد'}`,
    `- المستوى: ${student.level}`,
    `- عدد الدروس المكتملة: ${completedLessons}`,
    `- متوسط درجات الاختبارات: ${avgScore !== null ? avgScore + '%' : 'لا توجد اختبارات بعد'}`,
    `- عدد الاختبارات التي لم يجتزها: ${weakCount}`,
    'استخدم هذه البيانات لتقييم مستوى الطالب، وتحديد نقاط ضعفه، واقتراح خطوته التالية بدقة ووضوح.'
  ].join('\n');
}

export async function buildAdminContext(env) {
  const [students, courses, attempts, purchases] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) c FROM students').first(),
    env.DB.prepare('SELECT COUNT(*) c FROM courses WHERE is_published=1').first(),
    env.DB.prepare('SELECT AVG(percentage) avg_score, COUNT(*) c FROM attempts').first(),
    env.DB.prepare(`SELECT SUM(amount_cents) total FROM purchases WHERE status='confirmed'`).first()
  ]);
  const weakest = await env.DB.prepare(
    `SELECT quiz_id, AVG(percentage) avg_p, COUNT(*) n FROM attempts GROUP BY quiz_id ORDER BY avg_p ASC LIMIT 5`
  ).all();

  return [
    'أنت محلّل بيانات ذكي لمنصة تعليمية إسلامية اسمها "اسلامك تك". اكتب تحليلًا عمليًا موجّهًا للأدمن بالعربية.',
    `- عدد الطلاب: ${students.c}`,
    `- عدد الكورسات المنشورة: ${courses.c}`,
    `- عدد محاولات الاختبارات: ${attempts.c}, متوسط الدرجات: ${Math.round(attempts.avg_score || 0)}%`,
    `- إجمالي الإيرادات المؤكدة: ${(purchases.total || 0) / 100} جنيه`,
    `- أضعف 5 اختبارات (حسب متوسط الدرجة): ${JSON.stringify(weakest.results)}`,
    'حلّل الأداء العام، حدد نقاط الضعف في المحتوى أو الاختبارات، واقترح خطوات عملية لتحسين المنصة والإيرادات.'
  ].join('\n');
}
