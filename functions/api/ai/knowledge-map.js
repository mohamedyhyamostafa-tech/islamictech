import { requireStudent } from '../../_lib/auth.js';
import { callGemini, buildStudentContext } from '../../_lib/ai.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestPost({ request, env }) {
  let student;
  try { student = await requireStudent(request, env); }
  catch (e) { return error(e.message, e.status || 401); }

  const prompt =
    'بناءً على البيانات دي، اكتب تقرير مختصر منظم بعناوين واضحة يشمل:\n' +
    '1) تقييم المستوى الحالي\n2) نقاط القوة\n3) نقاط تحتاج تحسين\n' +
    '4) المسار والكورسات المقترحة بالترتيب\n5) خطوة عملية واحدة يبدأ بيها النهاردة.';

  let report;
  try {
    const context = await buildStudentContext(env, student);
    report = await callGemini(env, context, prompt);
  } catch (e) {
    return error(e.message, 500);
  }

  await env.DB.prepare('INSERT INTO ai_recommendations (email, report_text) VALUES (?, ?)')
    .bind(student.email, report).run();

  return json({ ok: true, report });
}
