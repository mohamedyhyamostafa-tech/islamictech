# 🕌 ISLAMIC TECH — Cloudflare Edition (Pages + Functions + D1 + R2)

نسخة كاملة الأركان، فيها:
- تسجيل دخول بحساب Google (بدون باسورد).
- كورسات/دروس مع فيديو مرن المصدر (يوتيوب/درايف/فيسبوك/Cloudflare Stream/أي رابط).
- كتب PDF مخزّنة على R2، مجانية أو مدفوعة.
- فيديوهات مفردة بره الكورسات، مجانية أو مدفوعة.
- اختبارات MCQ/نصية بتصحيح تلقائي حساس لحالة الأحرف، ودرجات وتتبع تقدم.
- تحديات ولوحة صدارة ونقاط.
- بوابة دفع: فورى (أوتوماتيك) أو تحويل يدوي (فودافون كاش/واتساب/تليجرام) يتحكم فيها الأدمن.
- مساعد ذكاء اصطناعي (Gemini) للطالب + محلل أداء للأدمن.
- لوحة أدمن كاملة (طلاب، كورسات، كويزات، كتب، فيديوهات، تحديات، دفع، طلبات، تقارير).

---

## ⚠️ حدود مهمة قبل ما تبدأ

1. **إنشاء الحسابات مسؤوليتك أنت.** حساب Cloudflare، Google Cloud، فورى،
   أو أي بوابة دفع لازم يتعمل بإيميلك/رقمك/بيانات نشاطك التجاري الحقيقية.
   الخطوات تحت هتوصلك لحسابك في دقايق.
2. **التوسع مرتبط بحدود حسابك.** المعمارية هنا (Cloudflare edge + D1 + R2)
   بتتوسّع فعليًا وأد ما تحتاج، لكن في حدود خطتك (تكلفة، حدود الاستخدام).
   لو المنصة كبرت هتحتاج تراقب استهلاك D1/R2 وتترقّى للخطط المدفوعة المناسبة.
3. **مفيش تقنية ويب تمنع تصوير الشاشة 100%.** أي حد يقدر يصور شاشته بموبايل
   تاني مهما اتعملت حماية. اللي موجود هنا هو **ردع حقيقي**:
   - الفيديو مبيتكشفش في كود الصفحة إلا بعد التحقق من تسجيل الدخول والصلاحية.
   - رابط الوصول مؤقت (10 دقايق) ومربوط بتوكن.
   - علامة مائية (اسم/إيميل الطالب) فوق الفيديو تفضل ظاهرة لو حد صوّر الشاشة.
   - كليك يمين معطّل على الفيديو.
   - لو استخدمت Cloudflare Stream فيه Signed URL Tokens حقيقية (خدمة مدفوعة).
4. **بوابة فورى محتاجة حساب تاجر فورى حقيقي** (سجل تجاري/نشاط مسجّل).
   لحد ما يجهز، النظام شغّال بالكامل بالتحويل اليدوي (فودافون كاش/واتساب/
   تليجرام) والأدمن يفعّل الطلب يدويًا من لوحة التحكم.

---

## الخطوات (حوالي 20-30 دقيقة أول مرة)

### 1) حساب Cloudflare
اعمل حساب مجاني على https://dash.cloudflare.com/sign-up (خطة Free كفاية
للبداية، وفيها Workers/Pages/D1/R2 بحدود سخية، وتقدر تترقّى وقت ما تحتاج).

### 2) تثبيت الأدوات
```bash
npm install -g wrangler
wrangler login
```

### 3) قاعدة البيانات D1
```bash
wrangler d1 create islamictech-db
```
هياديك `database_id` — حطه في `wrangler.toml` مكان
`REPLACE_AFTER_wrangler_d1_create`. بعدين:
```bash
npm run db:migrate
```

### 4) تخزين الكتب R2
```bash
wrangler r2 bucket create islamictech-books
```

### 5) Google Sign-In (تسجيل الدخول)
- روح https://console.cloud.google.com → مشروع جديد.
- APIs & Services → Credentials → Create Credentials → OAuth Client ID → Web application.
- في Authorized JavaScript origins حط دومين موقعك بعد النشر (مثلاً
  `https://islamictech.pages.dev`).
- انسخ الـ Client ID.

### 6) الأسرار (Secrets)
```bash
wrangler pages secret put SESSION_SECRET        # أي نص عشوائي طويل
wrangler pages secret put GOOGLE_CLIENT_ID
wrangler pages secret put ADMIN_EMAIL           # إيميلك اللي هتبقى بيه أول أدمن
wrangler pages secret put GEMINI_API_KEY        # من https://aistudio.google.com/apikey
```
اختياري (لو هتفعّل):
```bash
wrangler pages secret put YOUTUBE_API_KEY
wrangler pages secret put YOUTUBE_CHANNEL_ID
wrangler pages secret put FACEBOOK_PAGE_ID
wrangler pages secret put FACEBOOK_PAGE_ACCESS_TOKEN
wrangler pages secret put STREAM_CUSTOMER_CODE
wrangler pages secret put STREAM_SIGNING_KEY_ID
wrangler pages secret put STREAM_SIGNING_KEY_PEM
```

### 7) النشر
```bash
wrangler pages deploy public
```
هياديك رابط زي `https://islamictech.pages.dev`. سجّل دخول بإيميلك (اللي
حطيته في ADMIN_EMAIL) وهتلاقي نفسك أدمن تلقائيًا، وهيظهر ليك زرار "لوحة
الأدمن" في القايمة.

**رابط لوحة الأدمن معقّد ومخبّي عمدًا (مش /admin.html):**
```
/panel-1kdg11Ey02KcPgtPvTlm.html
```
احفظ اللينك ده كـ Bookmark. ده مش بديل عن الحماية الحقيقية (لسه بيتحقق من
دورك كأدمن من السيرفر كل مرة)، لكنه بيمنع أي حد يلاقي صفحة الأدمن بالصدفة
أو بالتخمين. لو عايز تغيّره لتوكن تاني، غيّر اسم الملفين
`public/panel-...html` و`public/panel-...js`، وغيّر اسم فولدر
`functions/api/adm-...` وحدّث المسارات جوه `panel-....js` (دور على
`/api/adm-` في الملف).

### 8) بوابة الدفع
- **تحويل يدوي (يشتغل فورًا):** من لوحة الأدمن → إعدادات الدفع → اختار
  القناة (فودافون كاش/واتساب/تليجرام) وحط الرقم/الرابط. خلاص جاهز.
- **فورى (أوتوماتيك):** لازم تسجّل كتاجر على https://fawry.com (قسم
  FawryPay للشركات/الأفراد) وتاخد `Merchant Code` و `Security Key`،
  وتحطهم في نفس صفحة إعدادات الدفع. راجع
  https://developer.fawrystaging.com لو شكل الـ API اتغيّر — كود التوقيع
  في `functions/api/payments/create-order.js` و `fawry-webhook.js`
  محتاج يتظبط لو فورى غيّروا حاجة.

---

## هيكل المشروع
- `public/` — الواجهة (index.html للطالب، panel-....html للأدمن، CSS/JS).
- `functions/api/` — كل الـ API (auth, courses, quizzes, challenges,
  media, payments, ai, adm-....) — كل ملف Cloudflare Pages Function مستقل.
- `functions/_lib/` — دوال مشتركة (auth.js, ai.js, response.js).
- `schema.sql` — شكل قاعدة بيانات D1 بالكامل (في الجذر، مش جوه فولدر).

## ⚠️ ليه فيه فولدرات جوّه functions/ ومش ممكن تتشال
Cloudflare Pages Functions بتحدد رابط كل API تلقائيًا من **مكان الملف نفسه**:
مثلاً `functions/api/courses/index.js` بيبقى تلقائيًا `/api/courses`.
لو اتحطت كل الملفات جنب بعض من غير فولدرات، كل الروابط هتتغيّر (هتبقى
كلها `/index`, `/index`, `/index`...) والموقع هيقف تمامًا. أي رفع للمشروع
لازم يحافظ على بنية الفولدرات زي ما هي بالظبط.

**إزاي تنشئ بنية الفولدرات من غير ما تعملها يدويًا واحدة واحدة:**

1. **الأسهل (بدون تثبيت أي حاجة):** روح لصفحة الريبو على GitHub → **Add file
   → Create new file**. في خانة اسم الملف، اكتب المسار الكامل زي
   `functions/api/courses/index.js` (بالسلاش). GitHub هيعمل الفولدرات
   تلقائيًا لوحده من غير ما تدوس "New folder" ولا مرة.
2. **الأسرع (لو هترفع المشروع كله دفعة واحدة):** نزّل Git من
   https://git-scm.com، وفي فولدر المشروع اللي فكيته من الزيب:
   ```bash
   git init
   git add .
   git commit -m "islamictech v1"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
   الأمر `git add .` بياخد كل الفولدرات والملفات جوّاها زي ما هي بالظبط،
   من غير ما تلمس فولدر واحد بإيدك.
3. أو استخدم **GitHub Desktop** (برنامج بواجهة رسومية بسيطة): "Add local
   repository" → اختار فولدر المشروع → Commit → Push. نفس الفكرة بدون Terminal.

## خطوات تالية مقترحة (مش مبنية في النسخة دي)
- الإجازة الرقمية (Ijazah) بكود QR للتحقق.
- متتبع الحفظ (Spaced Repetition) للقرآن/المتون.
- بوابة ولي الأمر (تقرير أسبوعي عن تقدم الابن).
- Cloudflare Turnstile على صفحة الدخول لمنع البوتات.
- تفعيل Cloudflare Stream فعليًا لو عايز حماية فيديو أقوى (مدفوع بشكل منفصل).

---

## 📄 الترخيص

راجع ملف `LICENSE` للتفاصيل.
