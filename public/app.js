const api = (path, opts = {}) => fetch(path, {
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  ...opts
}).then(async (r) => {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'حصل خطأ');
  return data;
});

let currentUser = null;

async function init() {
  const cfg = await api('/api/config');
  google.accounts.id.initialize({
    client_id: cfg.googleClientId,
    callback: onGoogleCredential
  });
  google.accounts.id.renderButton(document.getElementById('g_id_signin'), { theme: 'outline', size: 'medium' });

  try {
    currentUser = await api('/api/auth/me');
    showApp();
  } catch {
    document.getElementById('loginGate').classList.remove('hidden');
  }
}

async function onGoogleCredential(response) {
  try {
    const res = await api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
    currentUser = await api('/api/auth/me');
    showApp();
  } catch (e) {
    alert('فشل تسجيل الدخول: ' + e.message);
  }
}

function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('g_id_signin').classList.add('hidden');
  if (currentUser.role === 'admin') {
    // اللينك ده متبنيش في الـ HTML الأصلي خالص، بيتحقن هنا فقط بعد ما السيرفر
    // (مش الفرونت) يأكّد إن اليوزر أدمن فعلاً — عشان مفيش أي أثر ليه في الصفحة
    // لأي زائر عادي حتى لو فتح "View Page Source".
    const a = document.createElement('a');
    a.className = 'tab-btn';
    a.href = '/panel-1kdg11Ey02KcPgtPvTlm.html';
    a.textContent = 'لوحة الأدمن';
    document.querySelector('.tabs').insertBefore(a, document.getElementById('logoutBtn'));
  }
  loadCourses();
  loadBooks();
  loadVideos();
  loadChallenges();
  loadLeaderboard();
  loadAiHistory();
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.reload();
});

document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tabpage').forEach((p) => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

// ---------------- كورسات ----------------
async function loadCourses() {
  const { courses } = await api('/api/courses');
  const el = document.getElementById('tab-courses');
  el.innerHTML = '<h3 style="font-family:Amiri,serif;color:var(--emerald)">الكورسات</h3><div class="grid"></div>';
  const grid = el.querySelector('.grid');
  courses.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${c.title}</h3>
      <p>${c.description || ''}</p>
      <span class="badge-pill ${c.unlocked ? 'free' : 'locked'}">${c.unlocked ? (c.isFree ? 'مجاني' : 'مشترك بالفعل') : 'مدفوع — ' + (c.priceCents / 100) + ' جنيه'}</span>
      <div style="margin-top:10px;">
        ${c.lessons.map((l) => `<div class="lesson-row" data-lesson="${l.lessonId}" data-item="course:${c.courseId}">
          <span>${l.title}</span><span>${l.durationMin || ''} د</span>
        </div>`).join('') || '<p>لسه مفيش دروس مضافة</p>'}
      </div>
      ${!c.unlocked ? `<button class="btn buy-btn" data-type="course" data-id="${c.courseId}">اشترك دلوقتي</button>` : ''}
    `;
    grid.appendChild(card);
  });

  el.querySelectorAll('.lesson-row').forEach((row) => {
    row.addEventListener('click', () => openLesson(row.dataset.lesson));
  });
  el.querySelectorAll('.buy-btn').forEach((btn) => {
    btn.addEventListener('click', () => startPurchase(btn.dataset.type, btn.dataset.id));
  });
}

async function openLesson(lessonId) {
  let media;
  try {
    media = await api('/api/media/signed-url', { method: 'POST', body: JSON.stringify({ itemType: 'lesson', itemId: lessonId }) });
  } catch (e) {
    showModal(`<h3>مقفول</h3><p class="lock-notice">${e.message}</p>`);
    return;
  }

  const quizData = await api('/api/quizzes?lessonId=' + lessonId).catch(() => ({ quiz: null }));

  showModal(`
    <div class="video-wrap" id="videoWrap"></div>
    ${quizData.quiz ? `<button class="btn" id="openQuizBtn" style="margin-top:10px;">حل الاختبار</button>` : ''}
  `);
  renderVideo(document.getElementById('videoWrap'), media);

  if (quizData.quiz) {
    document.getElementById('openQuizBtn').addEventListener('click', () => openQuiz(quizData.quiz));
  }

  // إبلاغ التقدم بشكل تقريبي بعد 20 ثانية من الفتح (أبسط حل بدون تتبع دقيق للفيديو نفسه)
  setTimeout(() => api('/api/lessons/progress', { method: 'POST', body: JSON.stringify({ lessonId, percent: 100 }) }).catch(() => {}), 20000);
}

function renderVideo(container, media) {
  let inner = '';
  if (media.source === 'youtube') {
    inner = `<iframe src="https://www.youtube.com/embed/${media.ref}?rel=0" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  } else if (media.source === 'drive') {
    inner = `<iframe src="https://drive.google.com/file/d/${media.ref}/preview" allow="autoplay" allowfullscreen></iframe>`;
  } else if (media.source === 'facebook') {
    inner = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(media.ref)}" allowfullscreen></iframe>`;
  } else if (media.source === 'stream') {
    inner = `<iframe src="${media.playbackUrl}" allow="accelerometer; encrypted-media; autoplay;" allowfullscreen></iframe>`;
  } else {
    inner = `<iframe src="${media.ref}" allowfullscreen></iframe>`;
  }
  container.innerHTML = inner + `<div class="watermark">${media.watermark.email} • ${new Date(media.watermark.ts).toLocaleString('ar-EG')}</div>`;
  container.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------- كتب ----------------
async function loadBooks() {
  const { books } = await api('/api/media/books');
  const el = document.getElementById('tab-books');
  el.innerHTML = '<h3 style="font-family:Amiri,serif;color:var(--emerald)">الكتب</h3><div class="grid"></div>';
  const grid = el.querySelector('.grid');
  books.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${b.title}</h3>
      <p>${b.author || ''}</p>
      <p>${b.description || ''}</p>
      <span class="badge-pill ${b.unlocked ? 'free' : 'locked'}">${b.unlocked ? 'متاح' : 'مدفوع — ' + (b.priceCents / 100) + ' جنيه'}</span>
      <div style="margin-top:10px;">
        ${b.unlocked
          ? `<button class="btn open-book" data-id="${b.bookId}">افتح الكتاب</button>`
          : `<button class="btn buy-btn" data-type="book" data-id="${b.bookId}">اشترِ الكتاب</button>`}
      </div>`;
    grid.appendChild(card);
  });
  el.querySelectorAll('.open-book').forEach((btn) => btn.addEventListener('click', () => openBook(btn.dataset.id)));
  el.querySelectorAll('.buy-btn').forEach((btn) => btn.addEventListener('click', () => startPurchase(btn.dataset.type, btn.dataset.id)));
}

async function openBook(bookId) {
  const media = await api('/api/media/signed-url', { method: 'POST', body: JSON.stringify({ itemType: 'book', itemId: bookId }) }).catch((e) => {
    showModal(`<h3>مقفول</h3><p class="lock-notice">${e.message}</p>`); return null;
  });
  if (!media) return;
  showModal(`<iframe src="${media.downloadUrl}" style="width:100%;height:70vh;border:0;"></iframe>`);
}

// ---------------- فيديوهات مفردة ----------------
async function loadVideos() {
  const { videos } = await api('/api/media/videos');
  const el = document.getElementById('tab-videos');
  el.innerHTML = '<h3 style="font-family:Amiri,serif;color:var(--emerald)">فيديوهات مفردة</h3><div class="grid"></div>';
  const grid = el.querySelector('.grid');
  videos.forEach((v) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${v.title}</h3><p>${v.description || ''}</p>
      <span class="badge-pill ${v.unlocked ? 'free' : 'locked'}">${v.unlocked ? 'متاح' : 'مدفوع — ' + (v.priceCents / 100) + ' جنيه'}</span>
      <div style="margin-top:10px;">
        ${v.unlocked ? `<button class="btn open-video" data-id="${v.videoId}">شاهد الفيديو</button>`
          : `<button class="btn buy-btn" data-type="video" data-id="${v.videoId}">اشترِ الفيديو</button>`}
      </div>`;
    grid.appendChild(card);
  });
  el.querySelectorAll('.open-video').forEach((btn) => btn.addEventListener('click', async () => {
    const media = await api('/api/media/signed-url', { method: 'POST', body: JSON.stringify({ itemType: 'video', itemId: btn.dataset.id }) });
    showModal('<div class="video-wrap" id="videoWrap2"></div>');
    renderVideo(document.getElementById('videoWrap2'), media);
  }));
  el.querySelectorAll('.buy-btn').forEach((btn) => btn.addEventListener('click', () => startPurchase(btn.dataset.type, btn.dataset.id)));
}

// ---------------- الدفع ----------------
async function startPurchase(itemType, itemId) {
  const order = await api('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ itemType, itemId }) }).catch((e) => {
    showModal(`<p class="lock-notice">${e.message}</p>`); return null;
  });
  if (!order) return;
  if (order.alreadyPurchased || order.alreadyFree) { location.reload(); return; }

  if (order.method === 'fawry') {
    showModal(`<h3>الدفع عبر فورى</h3><p>هيتم تجهيز طلب فورى على السيرفر برقم الطلب: ${order.orderId}</p>`);
    return;
  }
  showModal(`
    <h3>تحويل يدوي</h3>
    <p>${order.instructions}</p>
    <input id="proofNote" placeholder="اكتب رقم عملية التحويل هنا" />
    <button class="btn" id="sendProofBtn" data-order="${order.orderId}">إرسال إثبات الدفع</button>
  `);
  document.getElementById('sendProofBtn').addEventListener('click', async (e) => {
    const note = document.getElementById('proofNote').value.trim();
    if (!note) return alert('اكتب رقم العملية الأول');
    await api('/api/payments/manual-note', { method: 'POST', body: JSON.stringify({ orderId: e.target.dataset.order, note }) });
    showModal('<p>تم إرسال إثبات الدفع، هيتم تفعيل المحتوى بعد مراجعة الأدمن.</p>');
  });
}

// ---------------- تحديات + لوحة صدارة ----------------
async function loadChallenges() {
  const { challenges } = await api('/api/challenges');
  const el = document.getElementById('tab-challenges');
  el.innerHTML = '<h3 style="font-family:Amiri,serif;color:var(--emerald)">التحديات النشطة</h3><div class="grid"></div>';
  const grid = el.querySelector('.grid');
  challenges.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${c.title}</h3><p>${c.description || ''}</p><p>نقاط: ${c.points}</p>
      <button class="btn join-btn" data-id="${c.id}">اشترك</button>`;
    grid.appendChild(card);
  });
  el.querySelectorAll('.join-btn').forEach((btn) => btn.addEventListener('click', async () => {
    await api('/api/challenges/join', { method: 'POST', body: JSON.stringify({ challengeId: btn.dataset.id }) });
    btn.textContent = 'تم الاشتراك ✔';
  }));
}

async function loadLeaderboard() {
  const { leaderboard } = await api('/api/challenges/leaderboard?limit=20');
  const el = document.getElementById('tab-leaderboard');
  el.innerHTML = '<h3 style="font-family:Amiri,serif;color:var(--emerald)">لوحة الصدارة</h3><div class="card"></div>';
  const box = el.querySelector('.card');
  leaderboard.forEach((s, i) => {
    box.innerHTML += `<div class="leaderboard-row"><span>${i + 1}. ${s.full_name}</span><span>${s.points} نقطة</span></div>`;
  });
}

// ---------------- كويز ----------------
function openQuiz(quiz) {
  showModal(`
    <h3>${quiz.title}</h3>
    <form id="quizForm">
      ${quiz.questions.map((q, i) => `
        <div class="card">
          <p>${i + 1}. ${q.text}</p>
          ${q.type === 'mcq'
            ? q.options.map((opt) => `<label style="display:block"><input type="radio" name="${q.questionId}" value="${opt}"> ${opt}</label>`).join('')
            : `<input name="${q.questionId}" placeholder="إجابتك" />`}
        </div>`).join('')}
      <button class="btn" type="submit">تسليم</button>
    </form>
    <div id="quizResult"></div>
  `);
  document.getElementById('quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const answers = {};
    for (const [k, v] of fd.entries()) answers[k] = v;
    const result = await api('/api/quizzes/submit', { method: 'POST', body: JSON.stringify({ quizId: quiz.quizId, answers }) });
    document.getElementById('quizResult').innerHTML =
      `<p class="badge-pill ${result.passed ? 'pass' : 'fail'}">النتيجة: ${result.score}/${result.max} (${result.percentage}%) — ${result.passed ? 'ناجح' : 'راسب'}</p>`;
  });
}

// ---------------- المساعد الذكي ----------------
async function loadAiHistory() {
  const { history } = await api('/api/ai/history');
  const box = document.getElementById('chatBox');
  box.innerHTML = '';
  history.forEach((m) => appendChatMsg(m.role, m.message));
}
function appendChatMsg(role, text) {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
document.getElementById('chatSend').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  appendChatMsg('user', msg);
  input.value = '';
  const { reply } = await api('/api/ai/ask', { method: 'POST', body: JSON.stringify({ message: msg }) });
  appendChatMsg('assistant', reply);
}
document.getElementById('knowledgeMapBtn').addEventListener('click', async () => {
  document.getElementById('knowledgeMapResult').textContent = 'جاري التحليل...';
  const { report } = await api('/api/ai/knowledge-map', { method: 'POST' });
  document.getElementById('knowledgeMapResult').textContent = report;
});

// ---------------- مودال عام ----------------
function showModal(innerHtml) {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">${innerHtml}<button class="btn-outline" id="closeModalBtn" style="margin-top:12px;">إغلاق</button></div>
    </div>`;
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

init();
