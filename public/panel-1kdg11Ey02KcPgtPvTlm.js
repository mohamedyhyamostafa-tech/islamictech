const api = (path, opts = {}) => fetch(path, {
  credentials: 'include', headers: { 'content-type': 'application/json' }, ...opts
}).then(async (r) => {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'حصل خطأ');
  return data;
});

document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tabpage').forEach((p) => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

async function guardAdmin() {
  try {
    const me = await api('/api/auth/me');
    if (me.role !== 'admin') { document.body.innerHTML = '<p style="padding:40px;text-align:center;">🚫 الصفحة دي للأدمن بس.</p>'; return false; }
    return true;
  } catch { document.body.innerHTML = '<p style="padding:40px;text-align:center;">لازم تسجّل دخول من الصفحة الرئيسية الأول.</p>'; return false; }
}

async function loadStats() {
  const s = await api('/api/adm-1kdg11Ey02KcPgtPvTlm/dashboard');
  document.getElementById('tab-stats').innerHTML = `
    <div class="grid">
      <div class="stat"><b>${s.totalStudents}</b>عدد الطلاب</div>
      <div class="stat"><b>${s.publishedCourses}/${s.totalCourses}</b>كورسات منشورة</div>
      <div class="stat"><b>${s.totalQuizAttempts}</b>محاولات اختبار</div>
      <div class="stat"><b>${s.avgQuizScore}%</b>متوسط الدرجات</div>
      <div class="stat"><b>${s.totalRevenueEGP}</b>إجمالي الإيرادات (جنيه)</div>
      <div class="stat"><b>${s.totalConfirmedPurchases}</b>عمليات شراء مؤكدة</div>
    </div>`;
}

async function loadStudents() {
  const { students } = await api('/api/adm-1kdg11Ey02KcPgtPvTlm/students');
  const el = document.getElementById('tab-students');
  el.innerHTML = '<div class="card"><h3>الطلاب</h3>' + students.map((s) => `
    <div class="leaderboard-row">
      <span>${s.full_name} (${s.email}) — ${s.role} — ${s.points} نقطة</span>
      <span>
        <button class="btn-sm btn-outline" data-a="ban" data-e="${s.email}">حظر</button>
        <button class="btn-sm btn-outline" data-a="unban" data-e="${s.email}">فك حظر</button>
        <button class="btn-sm btn-outline" data-a="make_admin" data-e="${s.email}">ترقية لأدمن</button>
      </span>
    </div>`).join('') + '</div>';
  el.querySelectorAll('button[data-a]').forEach((btn) => btn.addEventListener('click', async () => {
    await api('/api/adm-1kdg11Ey02KcPgtPvTlm/students', { method: 'POST', body: JSON.stringify({ email: btn.dataset.e, action: btn.dataset.a }) });
    loadStudents();
  }));
}

function loadCoursesForm() {
  document.getElementById('tab-courses').innerHTML = `
    <div class="card">
      <h3>كورس جديد / تعديل</h3>
      <input id="c_id" placeholder="courseId (سيبه فاضي لو جديد)" />
      <input id="c_title" placeholder="العنوان" />
      <textarea id="c_desc" placeholder="الوصف"></textarea>
      <input id="c_cat" placeholder="القسم" />
      <input id="c_track" placeholder="المسار" />
      <input id="c_level" placeholder="المستوى" />
      <label><input type="checkbox" id="c_free" checked style="width:auto"> مجاني</label>
      <input id="c_price" placeholder="السعر بالقروش لو مدفوع (100=1 جنيه)" />
      <label><input type="checkbox" id="c_pub" style="width:auto"> منشور</label>
      <button class="btn" id="saveCourseBtn">حفظ الكورس</button>
      <p id="courseMsg"></p>
    </div>
    <div class="card">
      <h3>درس جديد / تعديل</h3>
      <input id="l_id" placeholder="lessonId (سيبه فاضي لو جديد)" />
      <input id="l_course" placeholder="courseId بتاع الكورس" />
      <input id="l_title" placeholder="عنوان الدرس" />
      <select id="l_source">
        <option value="youtube">يوتيوب</option>
        <option value="drive">جوجل درايف</option>
        <option value="facebook">فيسبوك</option>
        <option value="stream">Cloudflare Stream</option>
        <option value="external">رابط خارجي/embed</option>
      </select>
      <input id="l_ref" placeholder="youtube id / drive file id / رابط الفيديو" />
      <input id="l_order" placeholder="ترتيب الدرس" />
      <input id="l_duration" placeholder="المدة بالدقايق" />
      <textarea id="l_content" placeholder="محتوى/ملاحظات نصية"></textarea>
      <button class="btn" id="saveLessonBtn">حفظ الدرس</button>
      <p id="lessonMsg"></p>
    </div>`;

  document.getElementById('saveCourseBtn').addEventListener('click', async () => {
    const body = {
      courseId: val('c_id') || undefined, title: val('c_title'), description: val('c_desc'),
      category: val('c_cat'), track: val('c_track'), level: val('c_level'),
      isFree: document.getElementById('c_free').checked, priceCents: Number(val('c_price')) || 0,
      isPublished: document.getElementById('c_pub').checked
    };
    const res = await api('/api/courses', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('courseMsg').textContent = res.error || 'تم الحفظ — courseId: ' + res.courseId;
  });

  document.getElementById('saveLessonBtn').addEventListener('click', async () => {
    const body = {
      lessonId: val('l_id') || undefined, courseId: val('l_course'), title: val('l_title'),
      videoSource: val('l_source'), videoRef: val('l_ref'), orderIndex: Number(val('l_order')) || 0,
      durationMin: Number(val('l_duration')) || 0, content: val('l_content')
    };
    const res = await api('/api/courses/lesson', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('lessonMsg').textContent = res.error || 'تم الحفظ — lessonId: ' + res.lessonId;
  });
}

function loadQuizzesForm() {
  document.getElementById('tab-quizzes').innerHTML = `
    <div class="card">
      <h3>كويز جديد / تعديل</h3>
      <input id="q_id" placeholder="quizId (فاضي لو جديد)" />
      <input id="q_lesson" placeholder="lessonId المرتبط" />
      <input id="q_title" placeholder="عنوان الكويز" />
      <input id="q_pass" placeholder="درجة النجاح % (افتراضي 60)" />
      <button class="btn" id="saveQuizBtn">حفظ الكويز</button>
      <p id="quizMsg"></p>
    </div>
    <div class="card">
      <h3>سؤال جديد / تعديل</h3>
      <input id="qq_id" placeholder="questionId (فاضي لو جديد)" />
      <input id="qq_quiz" placeholder="quizId المرتبط" />
      <textarea id="qq_text" placeholder="نص السؤال"></textarea>
      <select id="qq_type"><option value="mcq">اختيار من متعدد</option><option value="text">إجابة نصية</option></select>
      <input id="qq_options" placeholder="الاختيارات مفصولة بفاصلة (لو MCQ)" />
      <input id="qq_correct" placeholder="الإجابة الصحيحة (حساس لحالة الأحرف)" />
      <input id="qq_points" placeholder="الدرجة" />
      <input id="qq_order" placeholder="الترتيب" />
      <button class="btn" id="saveQuestionBtn">حفظ السؤال</button>
      <p id="questionMsg"></p>
    </div>`;

  document.getElementById('saveQuizBtn').addEventListener('click', async () => {
    const body = { quizId: val('q_id') || undefined, lessonId: val('q_lesson'), title: val('q_title'), passingScore: Number(val('q_pass')) || 60 };
    const res = await api('/api/quizzes', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('quizMsg').textContent = res.error || 'تم الحفظ — quizId: ' + res.quizId;
  });

  document.getElementById('saveQuestionBtn').addEventListener('click', async () => {
    const options = val('qq_options').split(',').map((s) => s.trim()).filter(Boolean);
    const body = {
      questionId: val('qq_id') || undefined, quizId: val('qq_quiz'), text: val('qq_text'),
      type: val('qq_type'), options, correctAnswer: val('qq_correct'),
      points: Number(val('qq_points')) || 1, orderIndex: Number(val('qq_order')) || 0
    };
    const res = await api('/api/quizzes/question', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('questionMsg').textContent = res.error || 'تم الحفظ — questionId: ' + res.questionId;
  });
}

function loadBooksForm() {
  document.getElementById('tab-books').innerHTML = `
    <div class="card">
      <h3>رفع كتاب PDF</h3>
      <input type="file" id="bookFile" accept="application/pdf" />
      <button class="btn" id="uploadBookBtn">ارفع الملف</button>
      <p id="uploadMsg"></p>
    </div>
    <div class="card">
      <h3>بيانات الكتاب</h3>
      <input id="b_id" placeholder="bookId (فاضي لو جديد)" />
      <input id="b_title" placeholder="العنوان" />
      <input id="b_author" placeholder="المؤلف" />
      <textarea id="b_desc" placeholder="الوصف"></textarea>
      <input id="b_cat" placeholder="القسم" />
      <input id="b_filekey" placeholder="fileKey (هيتملى تلقائي بعد الرفع)" />
      <label><input type="checkbox" id="b_free" checked style="width:auto"> مجاني</label>
      <input id="b_price" placeholder="السعر بالقروش لو مدفوع" />
      <button class="btn" id="saveBookBtn">حفظ الكتاب</button>
      <p id="bookMsg"></p>
    </div>`;

  document.getElementById('uploadBookBtn').addEventListener('click', async () => {
    const file = document.getElementById('bookFile').files[0];
    if (!file) return alert('اختار ملف الأول');
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/media/upload-book', { method: 'POST', credentials: 'include', body: fd })
      .then((r) => r.json());
    if (res.ok) { document.getElementById('b_filekey').value = res.fileKey; document.getElementById('uploadMsg').textContent = 'تم الرفع ✔'; }
    else document.getElementById('uploadMsg').textContent = res.error;
  });

  document.getElementById('saveBookBtn').addEventListener('click', async () => {
    const body = {
      bookId: val('b_id') || undefined, title: val('b_title'), author: val('b_author'), description: val('b_desc'),
      category: val('b_cat'), fileKey: val('b_filekey'), isFree: document.getElementById('b_free').checked,
      priceCents: Number(val('b_price')) || 0
    };
    const res = await api('/api/media/books', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('bookMsg').textContent = res.error || 'تم الحفظ — bookId: ' + res.bookId;
  });
}

function loadVideosForm() {
  document.getElementById('tab-videos').innerHTML = `
    <div class="card">
      <h3>فيديو مفرد جديد / تعديل</h3>
      <input id="v_id" placeholder="videoId (فاضي لو جديد)" />
      <input id="v_title" placeholder="العنوان" />
      <textarea id="v_desc" placeholder="الوصف"></textarea>
      <input id="v_cat" placeholder="القسم" />
      <select id="v_source">
        <option value="youtube">يوتيوب</option><option value="drive">جوجل درايف</option>
        <option value="facebook">فيسبوك</option><option value="stream">Cloudflare Stream</option>
        <option value="external">رابط خارجي</option>
      </select>
      <input id="v_ref" placeholder="المرجع (id/رابط)" />
      <label><input type="checkbox" id="v_free" checked style="width:auto"> مجاني</label>
      <input id="v_price" placeholder="السعر بالقروش لو مدفوع" />
      <button class="btn" id="saveVideoBtn">حفظ</button>
      <p id="videoMsg"></p>
    </div>`;
  document.getElementById('saveVideoBtn').addEventListener('click', async () => {
    const body = {
      videoId: val('v_id') || undefined, title: val('v_title'), description: val('v_desc'), category: val('v_cat'),
      videoSource: val('v_source'), videoRef: val('v_ref'), isFree: document.getElementById('v_free').checked,
      priceCents: Number(val('v_price')) || 0
    };
    const res = await api('/api/media/videos', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('videoMsg').textContent = res.error || 'تم الحفظ — videoId: ' + res.videoId;
  });
}

function loadChallengesForm() {
  document.getElementById('tab-challenges').innerHTML = `
    <div class="card">
      <h3>تحدي جديد / تعديل</h3>
      <input id="ch_id" placeholder="challengeId (فاضي لو جديد)" />
      <input id="ch_title" placeholder="العنوان" />
      <textarea id="ch_desc" placeholder="الوصف"></textarea>
      <input id="ch_type" placeholder="النوع" />
      <input id="ch_points" placeholder="النقاط" />
      <input id="ch_start" type="date" />
      <input id="ch_end" type="date" />
      <button class="btn" id="saveChallengeBtn">حفظ</button>
      <p id="challengeMsg"></p>
    </div>`;
  document.getElementById('saveChallengeBtn').addEventListener('click', async () => {
    const body = {
      challengeId: val('ch_id') || undefined, title: val('ch_title'), description: val('ch_desc'),
      type: val('ch_type'), points: Number(val('ch_points')) || 0, startDate: val('ch_start'), endDate: val('ch_end')
    };
    const res = await api('/api/challenges', { method: 'POST', body: JSON.stringify(body) }).catch((e) => ({ error: e.message }));
    document.getElementById('challengeMsg').textContent = res.error || 'تم الحفظ — challengeId: ' + res.challengeId;
  });
}

async function loadPaymentsForm() {
  const { settings } = await api('/api/payments/settings');
  document.getElementById('tab-payments').innerHTML = `
    <div class="card">
      <h3>إعدادات بوابة الدفع</h3>
      <select id="p_method">
        <option value="manual" ${settings.active_method === 'manual' ? 'selected' : ''}>تحويل يدوي</option>
        <option value="fawry" ${settings.active_method === 'fawry' ? 'selected' : ''}>فورى (أوتوماتيك)</option>
      </select>
      <select id="p_channel">
        <option value="vodafone_cash" ${settings.manual_channel === 'vodafone_cash' ? 'selected' : ''}>فودافون كاش</option>
        <option value="whatsapp" ${settings.manual_channel === 'whatsapp' ? 'selected' : ''}>واتساب</option>
        <option value="telegram" ${settings.manual_channel === 'telegram' ? 'selected' : ''}>تليجرام</option>
      </select>
      <input id="p_contact" placeholder="رقم فودافون كاش / رابط واتساب / رابط تليجرام" value="${settings.manual_contact || ''}" />
      <input id="p_merchant" placeholder="Fawry Merchant Code" value="${settings.fawry_merchant_code || ''}" />
      <input id="p_seckey" placeholder="Fawry Security Key" value="${settings.fawry_security_key || ''}" />
      <button class="btn" id="savePaymentsBtn">حفظ الإعدادات</button>
      <p id="paymentsMsg"></p>
    </div>`;
  document.getElementById('savePaymentsBtn').addEventListener('click', async () => {
    const body = {
      activeMethod: val('p_method'), manualChannel: val('p_channel'), manualContact: val('p_contact'),
      fawryMerchantCode: val('p_merchant'), fawrySecurityKey: val('p_seckey')
    };
    await api('/api/payments/settings', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('paymentsMsg').textContent = 'تم الحفظ ✔';
  });
}

async function loadOrders() {
  const { orders } = await api('/api/payments/admin-orders');
  document.getElementById('tab-orders').innerHTML = '<div class="card"><h3>طلبات تحتاج مراجعة</h3>' +
    (orders.length ? orders.map((o) => `
      <div class="leaderboard-row">
        <span>${o.email} — ${o.item_type}:${o.item_id} — ${(o.amount_cents / 100)} جنيه — ملاحظة: ${o.manual_note || '—'}</span>
        <span>
          <button class="btn-sm btn" data-a="confirm" data-id="${o.id}">تأكيد</button>
          <button class="btn-sm btn-outline" data-a="reject" data-id="${o.id}">رفض</button>
        </span>
      </div>`).join('') : '<p>مفيش طلبات معلّقة</p>') + '</div>';
  document.querySelectorAll('#tab-orders button[data-a]').forEach((btn) => btn.addEventListener('click', async () => {
    await api('/api/payments/admin-orders', { method: 'POST', body: JSON.stringify({ orderId: btn.dataset.id, action: btn.dataset.a }) });
    loadOrders();
  }));
}

function loadAiTab() {
  document.getElementById('tab-ai').innerHTML = `
    <div class="card">
      <h3>تحليل المنصة بالذكاء الاصطناعي</h3>
      <button class="btn" id="genReportBtn">حلّل الأداء دلوقتي</button>
      <div id="aiReportResult" style="white-space:pre-wrap; margin-top:10px;"></div>
    </div>`;
  document.getElementById('genReportBtn').addEventListener('click', async () => {
    document.getElementById('aiReportResult').textContent = 'جاري التحليل...';
    const res = await api('/api/ai/admin-report', { method: 'POST' }).catch((e) => ({ error: e.message }));
    document.getElementById('aiReportResult').textContent = res.report || res.error;
  });
}

async function loadSocial() {
  const el = document.getElementById('tab-social');
  el.innerHTML = '<div class="card"><button class="btn" id="fetchSocialBtn">تحديث إحصائيات يوتيوب/فيسبوك</button><div id="socialResult" style="margin-top:10px;"></div></div>';
  document.getElementById('fetchSocialBtn').addEventListener('click', async () => {
    const res = await api('/api/adm-1kdg11Ey02KcPgtPvTlm/social-stats').catch((e) => ({ error: e.message }));
    document.getElementById('socialResult').textContent = JSON.stringify(res, null, 2);
  });
}

function val(id) { return document.getElementById(id).value.trim(); }

(async () => {
  if (!(await guardAdmin())) return;
  loadStats(); loadStudents(); loadCoursesForm(); loadQuizzesForm();
  loadBooksForm(); loadVideosForm(); loadChallengesForm();
  loadPaymentsForm(); loadOrders(); loadAiTab(); loadSocial();
})();
