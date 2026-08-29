-- ISLAMIC TECH — Cloudflare D1 schema
-- شغّلها بـ: wrangler d1 execute islamictech-db --file=migrations/0001_init.sql --remote

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',       -- student | admin
  track TEXT DEFAULT '',
  level TEXT DEFAULT 'مبتدئ',
  points INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  track TEXT DEFAULT '',
  level TEXT DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL DEFAULT 0,      -- بالقروش (100 = جنيه)
  cover_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الفيديو مرن حسب المصدر: youtube / drive / facebook / stream (Cloudflare Stream) / external
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  video_source TEXT NOT NULL DEFAULT 'youtube',
  video_ref TEXT NOT NULL DEFAULT '',          -- id يوتيوب / رابط درايف / رابط فيسبوك / uid ستريم
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 0,
  content TEXT DEFAULT '',
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE(email, lesson_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mcq',
  options_json TEXT DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  answers_json TEXT DEFAULT '{}',
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL,
  email TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(challenge_id, email)
);

-- كتب PDF (مخزّنة في R2)
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  file_key TEXT NOT NULL,          -- المفتاح جوه R2 bucket
  is_free INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- فيديوهات منفردة (مش جوه كورس) — نفس مرونة المصدر
CREATE TABLE IF NOT EXISTS standalone_videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  video_source TEXT NOT NULL DEFAULT 'youtube',
  video_ref TEXT NOT NULL DEFAULT '',
  is_free INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- المدفوعات: فورى أوتوماتيك أو تحويل يدوي (فودافون كاش/واتساب/تليجرام)
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  item_type TEXT NOT NULL,          -- course | book | video
  item_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,             -- fawry | manual
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected
  fawry_ref TEXT DEFAULT '',
  manual_note TEXT DEFAULT '',      -- رقم العملية اللي الطالب كتبه لو تحويل يدوي
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

-- إعدادات بوابة الدفع يتحكم فيها الأدمن من لوحة التحكم
CREATE TABLE IF NOT EXISTS payment_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO payment_settings (key, value) VALUES
  ('active_method', 'manual'),          -- fawry | manual
  ('manual_channel', 'vodafone_cash'),  -- vodafone_cash | whatsapp | telegram
  ('manual_contact', ''),               -- رقم الفودافون كاش أو لينك الواتس/التليجرام
  ('fawry_merchant_code', ''),
  ('fawry_security_key', '');

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,               -- user | assistant
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  report_text TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- تقرير الذكاء الاصطناعي للأدمن (تحليل شامل للمنصة)
CREATE TABLE IF NOT EXISTS ai_admin_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_text TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS social_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  metric TEXT NOT NULL,
  value TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  lesson_ids_csv TEXT DEFAULT ''
);

-- روابط موقّتة لمشاهدة فيديو/تحميل كتاب — تنتهي صلاحيتها (ردع النسخ/المشاركة، مش منع مطلق)
CREATE TABLE IF NOT EXISTS media_access_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  item_type TEXT NOT NULL,     -- lesson | book | video
  item_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_email ON progress(email);
CREATE INDEX IF NOT EXISTS idx_attempts_email ON attempts(email);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
