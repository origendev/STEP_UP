import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { XMLParser } from 'fast-xml-parser';
import { extract } from '@extractus/article-extractor';
import { GoogleDecoder } from 'google-news-url-decoder';
import { randomUUID } from 'node:crypto';
import { getLaborMarket } from './labor-market.js';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;
const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
const DEMAND_AI_PROVIDER = (process.env.DEMAND_AI_PROVIDER || 'gemini').toLowerCase();
const MAX_NEWS_PER_SECTION = 10;
const RECENT_NEWS_DAYS = 7;
const ROLE_OUTLOOK_CACHE_MS = 60 * 60 * 1000;
const ROLE_OUTLOOK_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
});

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, '../FRONTEND');

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(s => s.trim())
    : true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.static(frontendDir));

const clean = v => typeof v === 'string' ? v.trim() : v;
const ELIGIBLE_DEPARTMENTS = ['CSE','IT','EEE','ECE','Mechanical','Civil'];

function normalizeEligibleDepartments(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(clean).filter(Boolean))].filter(d => ELIGIBLE_DEPARTMENTS.includes(d));
}

const newsArticleCache = new Map();
const googleNewsDecoder = new GoogleDecoder();
const demandRolesCache = new Map();
const demandRolesCacheAt = new Map();
const demandRolesInFlight = new Map();

/* =========================================================
   STUDENT AUTHENTICATION AND HELPERS
========================================================= */

function issueStudentToken(student) {
  return jwt.sign(
    {
      studentId: student.id,
      email: student.email,
      role: 'student'
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireStudent(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Student authentication required.'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== 'student' || !payload.studentId) {
      return res.status(403).json({
        error: 'Student access required.'
      });
    }

    req.student = payload;
    next();
  } catch {
    return res.status(401).json({
      error: 'Session expired. Please sign in again.'
    });
  }
}

function issueAdminToken() {
  return jwt.sign(
    { role: 'admin', adminId: ADMIN_ID },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireAdmin(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === 'admin' && payload.adminId) {
        req.admin = payload;
        const role = payload.adminRole || 'Super Admin';
        if (role !== 'Super Admin' && req.method !== 'GET') {
          const path = req.path;
          const allowed = role === 'Viewer' ? false : role === 'Recruiter Manager' ? /companies|jobs|applications|drives|interviews/.test(path) : true;
          if (!allowed) return res.status(403).json({ error: 'Your admin role does not have permission for this action.' });
        }
        return next();
      }
    } catch {
      return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    }
  }

  if (ADMIN_KEY && req.get('x-admin-key') === ADMIN_KEY) {
    req.admin = { role: 'admin', adminId: ADMIN_ID };
    return next();
  }

  return res.status(403).json({
    error: 'Admin authorization required.'
  });
}

function randomPassword(length = 12) {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

  let out = '';

  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendResetEmail({ to, name, otp }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  if (!process.env.MAIL_FROM) {
    throw new Error('MAIL_FROM is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: ['origen.enterprise@gmail.com'],
      subject: 'StepUp Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>StepUp Password Reset</h2>

          <p>Hello ${name},</p>

          <p>Your StepUp password reset OTP is:</p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 20px 0;
          ">
            ${otp}
          </div>

          <p>This OTP expires in <strong>10 minutes</strong>.</p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>StepUp Placement Portal</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Resend email failed (${response.status}): ${errorText}`
    );
  }

  return true;
}

/* =========================================================
   COMPANY AUTHENTICATION
========================================================= */

function issueToken(company) {
  return jwt.sign(
    {
      companyId: company.id,
      email: company.email
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireCompany(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.'
    });
  }

  try {
    req.company = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: 'Session expired. Please sign in again.'
    });
  }
}

function validateJob(b) {
  for (const k of [
    'title',
    'jobType',
    'applyBefore'
  ]) {
    if (!clean(b[k])) {
      return `${k} is required.`;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.applyBefore)) {
    return 'Apply-before date must be YYYY-MM-DD.';
  }

  if (
    b.visitDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(b.visitDate)
  ) {
    return 'Visit date must be YYYY-MM-DD.';
  }

  const rawDepartments = Array.isArray(b.eligibleDepartments) ? b.eligibleDepartments.map(clean).filter(Boolean) : [];
  const departments = normalizeEligibleDepartments(rawDepartments);
  if (!departments.length) {
    return 'Select at least one eligible department.';
  }
  if (rawDepartments.some(d => !ELIGIBLE_DEPARTMENTS.includes(d))) {
    return 'Eligible departments contain an invalid value.';
  }

  return null;
}

/* =========================================================
   NEWS CACHE
========================================================= */

function cacheNewsArticles(articles) {
  const now = Date.now();

  for (const [id, cached] of newsArticleCache) {
    if (now - cached.cachedAt > 30 * 60 * 1000) {
      newsArticleCache.delete(id);
    }
  }

  const cachedArticles = articles.map(article => {
    const id = randomUUID();

    newsArticleCache.set(id, {
      ...article,
      cachedAt: now
    });

    return {
      ...article,
      id
    };
  });

  while (newsArticleCache.size > 300) {
    newsArticleCache.delete(
      newsArticleCache.keys().next().value
    );
  }

  return cachedArticles;
}

/* =========================================================
   DATABASE SCHEMA
========================================================= */

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      website TEXT,
      industry TEXT NOT NULL DEFAULT 'IT',
      location TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL
        REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      job_type TEXT NOT NULL,
      salary TEXT,
      stipend TEXT,
      apply_before DATE NOT NULL,
      visit_date DATE,
      visit_tag TEXT,
      status TEXT NOT NULL DEFAULT 'Eligible',
      status_class TEXT NOT NULL DEFAULT 'status-amber',
      batch TEXT,
      location TEXT,
      work_mode TEXT,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'eligible',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Backward-compatible migrations for databases created by older STEP_UP versions.
    -- CREATE TABLE IF NOT EXISTS does not add missing columns to an existing table.
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stipend TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS apply_before DATE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visit_date DATE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visit_tag TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Eligible';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status_class TEXT NOT NULL DEFAULT 'status-amber';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS batch TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_mode TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'eligible';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_rounds TEXT NOT NULL DEFAULT 'Not specified';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    -- Approval is tracked per job listing, not per company. Existing jobs remain visible.
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Approved';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_note TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
    ALTER TABLE jobs ALTER COLUMN approval_status SET DEFAULT 'Pending';
    CREATE INDEX IF NOT EXISTS idx_jobs_approval_status ON jobs(approval_status, created_at DESC);

    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'IT';

    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS location TEXT;

    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS description TEXT;

    CREATE INDEX IF NOT EXISTS idx_jobs_company_id
      ON jobs(company_id);

    CREATE INDEX IF NOT EXISTS idx_jobs_apply_before
      ON jobs(apply_before);

    CREATE INDEX IF NOT EXISTS idx_jobs_category
      ON jobs(category);

    CREATE TABLE IF NOT EXISTS job_departments (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      department TEXT NOT NULL,
      UNIQUE(job_id, department)
    );

    CREATE INDEX IF NOT EXISTS idx_job_departments_job_id
      ON job_departments(job_id);

    INSERT INTO job_departments (job_id, department)
    SELECT j.id, d.department
    FROM jobs j
    CROSS JOIN (VALUES ('CSE'),('IT'),('EEE'),('ECE'),('Mechanical'),('Civil')) AS d(department)
    WHERE NOT EXISTS (SELECT 1 FROM job_departments jd WHERE jd.job_id=j.id);

    /* STUDENT TABLE */

    CREATE TABLE IF NOT EXISTS students (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      reg_no TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
      profile_completed BOOLEAN NOT NULL DEFAULT FALSE,

      phone TEXT,
      dob DATE,
      gender TEXT,
      address TEXT,
      college TEXT,
      degree TEXT,
      department TEXT,
      graduation_year INTEGER,
      study_year INTEGER NOT NULL DEFAULT 1 CHECK (study_year BETWEEN 1 AND 4),
      cgpa NUMERIC(4,2),

      education JSONB NOT NULL DEFAULT '[]'::jsonb,
      skills TEXT[] NOT NULL DEFAULT '{}',
      languages TEXT[] NOT NULL DEFAULT '{}',
      experience JSONB NOT NULL DEFAULT '[]'::jsonb,
      achievements TEXT,
      certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
      projects JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary TEXT,
      linkedin TEXT,
      github TEXT,
      portfolio TEXT,
      profile_details JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE students ADD COLUMN IF NOT EXISTS study_year INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE students DROP CONSTRAINT IF EXISTS students_study_year_check;
    ALTER TABLE students ADD CONSTRAINT students_study_year_check CHECK (study_year BETWEEN 1 AND 4);

    /* PASSWORD RESET OTP TABLE */

    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT NOT NULL
        REFERENCES students(id) ON DELETE CASCADE,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_student_reset_otps
      ON password_reset_otps(student_id, used);

    ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS interview_rounds TEXT NOT NULL DEFAULT 'Not specified';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '';

    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS job_applications (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'Applied',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(job_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_job_applications_job_id
      ON job_applications(job_id);

    CREATE INDEX IF NOT EXISTS idx_job_applications_student_id
      ON job_applications(student_id);

    CREATE TABLE IF NOT EXISTS assessment_attempts (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
      student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      round_index INTEGER NOT NULL CHECK (round_index >= 0),
      round_name TEXT NOT NULL,
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      submitted_at TIMESTAMPTZ,
      duration_seconds INTEGER NOT NULL DEFAULT 1800,
      score INTEGER,
      correct_count INTEGER,
      total_questions INTEGER,
      violation_count INTEGER NOT NULL DEFAULT 0,
      integrity_events JSONB NOT NULL DEFAULT '[]'::jsonb,
      auto_submitted BOOLEAN NOT NULL DEFAULT FALSE,
      company_verified BOOLEAN NOT NULL DEFAULT FALSE,
      company_decision TEXT,
      company_feedback TEXT,
      company_verified_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(application_id, student_id, round_index)
    );
    ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_decision TEXT;
    ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_feedback TEXT;
    ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_verified_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student ON assessment_attempts(student_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS student_resumes (
      student_id BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS resume_ai_analysis (
      student_id BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      resume_file_name TEXT NOT NULL,
      resume_uploaded_at TIMESTAMPTZ NOT NULL,
      analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
      analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_resume_ai_analysis_analyzed_at
      ON resume_ai_analysis(analyzed_at DESC);

    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'Active';

    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at
      ON admin_activity_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS placement_drives (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      drive_date DATE,
      eligible_batch TEXT,
      departments TEXT[] NOT NULL DEFAULT '{}',
      min_cgpa NUMERIC(4,2),
      backlogs_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      location TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Upcoming',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'All',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
      company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
      job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
      interview_date TIMESTAMPTZ,
      mode TEXT NOT NULL DEFAULT 'Online',
      meeting_link TEXT,
      interviewer TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Placement Officer',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

  `);


}

/* =========================================================
   HEALTH CHECK
========================================================= */

/* ------------------------------------------------------------
   StepUp AI assistant (home-page chatbot)
------------------------------------------------------------ */
const CHAT_SYSTEM_PROMPT = `You are "Step", the friendly robot assistant of StepUp, a placement hub for college students in India.
Help with: placement and interview preparation, resumes, aptitude/coding/HR rounds, skills to learn, job roles, career guidance, and how to use StepUp (Home, Jobs, Demands, Skills, Progress tabs and Profile).
Be warm, concise (under 150 words unless asked for more), practical, and use short bullet points when listing. Never invent specific job openings, salaries or statistics; say you are unsure instead. If asked something unrelated to studies, careers or StepUp, politely steer back.`;
const chatHits = new Map();

function cleanChatMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));
}

app.post('/api/chat', async (req, res) => {
  const now = Date.now();
  const hits = (chatHits.get(req.ip) || []).filter(t => now - t < 60000);
  if (hits.length >= 20) return res.status(429).json({ error: 'You are chatting too fast. Please wait a moment.' });
  hits.push(now);
  chatHits.set(req.ip, hits);

  const messages = cleanChatMessages(req.body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Send a message first.' });
  }

  try {
    let reply = '';
    if (DEMAND_AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: ROLE_OUTLOOK_MODEL,
          temperature: 0.5,
          max_tokens: 500,
          messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error?.message || `OpenAI returned ${r.status}`);
      reply = payload.choices?.[0]?.message?.content?.trim() || '';
    } else if (GEMINI_API_KEY) {
      const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];
      let lastError;
      for (const model of models) {
        try {
          console.log(`Chat: asking ${model}...`);
          const startedAt = Date.now();
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
                contents: messages.map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }]
                })),
                generationConfig: { temperature: 0.5, maxOutputTokens: 1500 }
              }),
              signal: AbortSignal.timeout(20000)
            }
          );
          const payload = await r.json();
          if (!r.ok) throw new Error(payload.error?.message || `Gemini returned ${r.status}`);
          reply = payload.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
          console.log(`Chat: ${model} answered in ${Date.now() - startedAt} ms`);
          if (!reply) throw new Error('empty answer (the model returned no text)');
          break;
        } catch (err) { console.warn(`Chat model ${model} failed: ${err.message}`); lastError = err; }
      }
      if (!reply && lastError) throw lastError;
    } else {
      return res.status(503).json({ error: 'AI is not configured. Add GEMINI_API_KEY to BACKEND/.env.' });
    }
    if (!reply) throw new Error('The assistant returned an empty answer.');
    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(502).json({ error: 'The assistant is busy right now. Please try again.' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      ok: true,
      database: 'postgresql'
    });
  } catch {
    res.status(503).json({
      ok: false,
      error: 'Database unavailable.'
    });
  }
});

/* =========================================================
   BUSINESS NEWS
========================================================= */

const NEWS_SECTIONS = [
  {
    category: 'India Markets & Economy',
    query:
      'India AND (economy OR markets OR RBI OR inflation OR rupee OR trade)',
    rssQuery:
      'India economy markets RBI inflation rupee business when:7d',
    locale: {
      hl: 'en-IN',
      gl: 'IN',
      ceid: 'IN:en'
    }
  },
  {
    category: 'India Placements & Hiring',
    query:
      'India AND ("campus placements" OR "IIT placements" OR "fresher hiring" OR "graduate jobs" OR "campus recruitment")',
    rssQuery:
      'India campus placements hiring fresher graduate jobs recruitment when:7d',
    locale: {
      hl: 'en-IN',
      gl: 'IN',
      ceid: 'IN:en'
    }
  },
  {
    category: 'Overseas Roles & Demand',
    query:
      '("United States" OR UK OR Canada OR Germany OR Australia OR UAE OR Singapore) AND (hiring OR recruitment OR "skills shortage" OR "in-demand roles" OR vacancies)',
    rssQuery:
      '(United States OR UK OR Canada OR Germany OR Australia OR UAE OR Singapore) (hiring OR recruitment OR "in-demand jobs" OR skills shortage) when:7d',
    locale: {
      hl: 'en-US',
      gl: 'US',
      ceid: 'US:en'
    }
  }
];

const newsXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

async function fetchNewsSection(section) {
  const url = new URL(
    'https://newsapi.org/v2/everything'
  );

  url.searchParams.set('q', section.query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', String(MAX_NEWS_PER_SECTION));
  url.searchParams.set('apiKey', NEWS_API_KEY);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  const payload = await response.json();

  if (!response.ok || payload.status !== 'ok') {
    throw new Error(
      payload.message ||
      `NewsAPI returned ${response.status}`
    );
  }

  return (payload.articles || [])
    .map(article => ({
      category: section.category,
      title: article.title || 'Business update',
      source: article.source?.name || 'News source',
      description:
        article.description || article.content || '',
      image: article.urlToImage || '',
      url: article.url || '',
      publishedAt: article.publishedAt || ''
    }))
    .filter(article => article.title && article.url);
}

async function fetchRssNewsSection(section) {
  const url = new URL(
    'https://news.google.com/rss/search'
  );

  url.searchParams.set('q', section.rssQuery);

  Object.entries(section.locale).forEach(
    ([key, value]) => url.searchParams.set(key, value)
  );

  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'Mozilla/5.0 StepUpNews/1.0'
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(
      `News RSS returned ${response.status}`
    );
  }

  const feed = newsXmlParser.parse(
    await response.text()
  );

  const entries = feed.rss?.channel?.item || [];

  const articles = Array.isArray(entries)
    ? entries
    : [entries];

  return articles.slice(0, MAX_NEWS_PER_SECTION).map(article => {
    const source = article.source?.['#text'] || article.source || 'Google News';
    const description = String(article.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      category: section.category,
      title: String(
        article.title || 'Market update'
      ).replace(
        new RegExp(
          `\\s+-\\s+${String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
        ),
        ''
      ),
      source,
      description,
      image: '',
      url: article.link || '',
      publishedAt: article.pubDate || ''
    };
  }).filter(article => article.title && article.url);
}

async function getBusinessNews() {
  const results = await Promise.allSettled(
    NEWS_SECTIONS.map(async section => {
      if (NEWS_API_KEY) {
        try {
          const articles = await fetchNewsSection(section);

          if (articles.length) {
            return {
              articles,
              provider: 'newsapi'
            };
          }
        } catch (error) {
          console.warn(
            `NewsAPI search failed for ${section.category}; trying RSS.`,
            error.message
          );
        }
      }

      const articles = await fetchRssNewsSection(section);

      return {
        articles,
        provider: 'google-news-rss'
      };
    })
  );

  const fetchedData = results.flatMap(
    result =>
      result.status === 'fulfilled'
        ? result.value.articles
        : []
  );

  const failedSections = results.filter(
    result => result.status === 'rejected'
  ).length;

  const usedRss = results.some(
    result =>
      result.status === 'fulfilled' &&
      result.value.provider === 'google-news-rss'
  );
  const cutoff = Date.now() - RECENT_NEWS_DAYS * 24 * 60 * 60 * 1000;
  const data = fetchedData
    .filter(article => {
      const publishedAt = Date.parse(article.publishedAt || '');
      return !Number.isFinite(publishedAt) || publishedAt >= cutoff;
    })
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));

  if (!data.length) {
    console.warn(
      'All regional news searches failed:',
      results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason.message)
        .join('; ')
    );

    return {
      data: [],
      summary:
        'Live news providers are temporarily unavailable. Please refresh later.'
    };
  }

  const summary =
    `Showing up to ${MAX_NEWS_PER_SECTION} headlines per topic from the past ${RECENT_NEWS_DAYS} days, sorted newest first. ` +
    `Recent headlines are grouped by Indian markets and economy, Indian placements and hiring, and overseas role demand.` +
    `${usedRss ? ' Some headlines are supplied by Google News RSS because direct NewsAPI access was unavailable.' : ''}` +
    `${failedSections ? ' Some groups could not be refreshed.' : ''}`;

  return {
    data,
    summary,
    source: usedRss
      ? 'google-news-rss'
      : 'newsapi'
  };
}

/* =========================================================
   NEWS ROUTES
========================================================= */
const DEMAND_COURSES = {
  cse: {
    label: 'Computer Science & Engineering (CSE)',
    terms: 'software engineering OR artificial intelligence OR machine learning OR data engineering OR cloud OR DevOps OR cybersecurity OR backend OR full stack',
    baseline: ['AI/ML Engineer', 'Software Engineer', 'Data Engineer', 'Cloud/DevOps Engineer', 'Cybersecurity Engineer']
  },
  it: {
    label: 'Information Technology (IT)',
    terms: 'software engineering OR cloud computing OR DevOps OR data engineering OR cybersecurity OR IT infrastructure OR platform engineering',
    baseline: ['Software Engineer', 'Cloud Engineer', 'DevOps Engineer', 'Data Engineer', 'Cybersecurity Engineer']
  },
  ece: {
    label: 'Electronics & Communication Engineering (ECE)',
    terms: 'embedded systems OR VLSI OR semiconductor OR ASIC OR verification OR IoT OR electronics OR telecom OR RF',
    baseline: ['Embedded Systems Engineer', 'VLSI Design Engineer', 'Verification Engineer', 'IoT Engineer', 'RF/Telecom Engineer']
  },
  eee: {
    label: 'Electrical & Electronics Engineering (EEE)',
    terms: 'power systems OR electrical engineering OR electric vehicles OR renewable energy OR industrial automation OR grid OR battery',
    baseline: ['Electrical Design Engineer', 'Power Systems Engineer', 'EV Engineer', 'Renewable Energy Engineer', 'Industrial Automation Engineer']
  },
  mechanical: {
    label: 'Mechanical Engineering',
    terms: 'mechanical engineering OR manufacturing OR product design OR automotive OR robotics OR automation OR CAD OR CAE',
    baseline: ['Design Engineer', 'Manufacturing Engineer', 'Automation Engineer', 'Automotive Engineer', 'CAE Engineer']
  },
  civil: {
    label: 'Civil Engineering',
    terms: 'civil engineering OR construction OR structural engineering OR infrastructure OR BIM OR transportation OR project engineering',
    baseline: ['Structural Engineer', 'Construction Engineer', 'BIM Engineer', 'Infrastructure Engineer', 'Project Engineer']
  }
};

const ROLE_OUTLOOK_AREAS = [1, 2, 3, 4, 5].map((number) => ({
  code: String(number).padStart(2, '0'),
  name: `Trending role ${number}`
}));

async function getCourseDemandNews(courseKey, market) {
  const course = DEMAND_COURSES[courseKey] || DEMAND_COURSES.cse;
  const isIndia = market === 'india';
  const region = isIndia
    ? 'India AND (hiring OR recruitment OR jobs OR vacancies OR placements)'
    : '(United States OR UK OR Canada OR Germany OR Australia OR UAE OR Singapore OR Japan) AND (hiring OR recruitment OR jobs OR vacancies OR skills shortage)';
  const section = {
    category: isIndia ? `India · ${course.label}` : `Global · ${course.label}`,
    query: `(${course.terms}) AND (${region})`,
    rssQuery: `${course.terms} ${isIndia ? 'India hiring recruitment jobs' : 'global international hiring recruitment jobs'} when:7d`,
    locale: isIndia ? { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' } : { hl: 'en-US', gl: 'US', ceid: 'US:en' }
  };
  try {
    if (NEWS_API_KEY) {
      const articles = await fetchNewsSection(section);
      if (articles.length) return { data: articles, source: 'newsapi' };
    }
  } catch (error) {
    console.warn(`Course demand NewsAPI failed for ${courseKey}/${market}; trying RSS.`, error.message);
  }
  try {
    const articles = await fetchRssNewsSection(section);
    return { data: articles, source: 'google-news-rss' };
  } catch (error) {
    console.warn(`Course demand RSS failed for ${courseKey}/${market}.`, error.message);
    return { data: [], source: 'unavailable' };
  }
}

const ROLE_BASELINE_SOURCE = {
  label: 'World Economic Forum · Future of Jobs 2025',
  url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/'
};

function generatedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function generatedList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string' && item.trim())
    .slice(0, maxItems)
    .map(item => item.trim().slice(0, maxLength));
}

const ROLE_OUTLOOK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    roles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code: { type: 'STRING' },
          name: { type: 'STRING' },
          signal: { type: 'STRING' },
          twoMonthOutlook: { type: 'STRING' },
          roles: { type: 'ARRAY', items: { type: 'STRING' } },
          india: { type: 'STRING' },
          international: { type: 'STRING' },
          skills: { type: 'ARRAY', items: { type: 'STRING' } },
          evidenceIndexes: { type: 'ARRAY', items: { type: 'INTEGER' } }
        },
        required: ['code', 'name', 'signal', 'twoMonthOutlook', 'roles', 'india', 'international', 'skills', 'evidenceIndexes']
      }
    }
  },
  required: ['summary', 'roles']
};

async function requestGeminiOutlook(prompt, model) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You produce careful, evidence-led career outlooks. Never fabricate data.' }]
        },
        contents: [{ parts: [{ text: JSON.stringify(prompt) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: ROLE_OUTLOOK_RESPONSE_SCHEMA,
          maxOutputTokens: 4096
        }
      }),
      signal: AbortSignal.timeout(30000)
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Gemini returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const text = payload.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned no role outlook content.');
  return { text, model };
}

async function generateDemandRoles(courseKey = 'cse', market = 'india') {
  const course = DEMAND_COURSES[courseKey] || DEMAND_COURSES.cse;
  const targetMarket = market === 'global' ? 'global' : 'india';
  const news = await getCourseDemandNews(courseKey, targetMarket);
  if (!news.data.length) throw new Error('No recent course-specific news is available to ground the role outlook.');

  const evidenceArticles = news.data.slice(0, 20);
  const evidenceContext = evidenceArticles.map((article, index) => ({
    index,
    category: article.category,
    title: article.title,
    publisher: article.source,
    publishedAt: article.publishedAt,
    description: String(article.description || '').slice(0, 450)
  }));

  const prompt = {
    task: 'Create a student-facing ranking of the 5 most currently trending job roles for the selected B.Tech course and selected market.',
    asOf: new Date().toISOString(),
    course: course.label,
    market: targetMarket === 'india' ? 'India' : 'Global / International',
    rules: [
      'Return JSON only with keys summary and roles.',
      'Return exactly 5 role objects, ranked from most to least currently trending for the selected course and market.',
      'Each role object needs code, name, signal, twoMonthOutlook, roles, india, international, skills, and evidenceIndexes.',
      'Use the supplied recent course-specific headlines as the primary evidence. Do not invent statistics, salaries, vacancies, hiring percentages, or guarantees.',
      'For India, use India-specific evidence only and prioritize the current Indian hiring market, Indian employers, GCCs, Indian industry activity, recruitment and vacancies.',
      'For Global, use international evidence across major markets such as the US, UK, Europe, Canada, Australia, Middle East and Asia-Pacific. Do not make India the primary evidence source.',
      'Do not simply reuse the baseline role list. Use the evidence to decide the actual role names and ranking. A baseline title may be used only when it is supported by the evidence.',
      'Prefer concrete job titles that a B.Tech student can actually search for. Include early-career roles where evidence supports them.',
      'Write twoMonthOutlook as a cautious qualitative near-term outlook from the asOf date. Do not present long-term workforce trends as proof of a two-month trend.',
      'If evidence is weak, explicitly say the signal is limited rather than fabricating a trend.',
      'Use only evidenceIndexes that refer to supplied headlines and directly support the role. Use an empty array when evidence is insufficient.'
    ],
    areas: ROLE_OUTLOOK_AREAS,
    baseline: { course: course.baseline, source: ROLE_BASELINE_SOURCE },
    evidence: evidenceContext
  };

  let generatedJsonText;
  let provider;
  let providerModel;
  if (DEMAND_AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
    let geminiResult;
    try {
      geminiResult = await requestGeminiOutlook(prompt, GEMINI_MODEL);
    } catch (error) {
      const temporaryFailure = error.status >= 500 || /high demand|overload|temporarily/i.test(error.message);
      if (!temporaryFailure || GEMINI_MODEL === GEMINI_FALLBACK_MODEL) throw error;
      console.warn(`Gemini model ${GEMINI_MODEL} is busy; retrying ${GEMINI_FALLBACK_MODEL}.`);
      geminiResult = await requestGeminiOutlook(prompt, GEMINI_FALLBACK_MODEL);
    }
    generatedJsonText = geminiResult.text;
    provider = 'gemini-free-tier';
    providerModel = geminiResult.model;
  } else if (DEMAND_AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ROLE_OUTLOOK_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You produce careful, evidence-led career outlooks. Never fabricate data.' },
          { role: 'user', content: JSON.stringify(prompt) }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `OpenAI returned ${response.status}`);
    generatedJsonText = payload.choices?.[0]?.message?.content || '';
    provider = 'openai';
    providerModel = ROLE_OUTLOOK_MODEL;
  } else if (DEMAND_AI_PROVIDER === 'openai') {
    throw new Error('OPENAI_API_KEY is not configured for the selected AI provider.');
  } else {
    throw new Error('Configure GEMINI_API_KEY for the free Gemini tier to enable AI role outlooks.');
  }

  let generated;
  try {
    generated = JSON.parse(generatedJsonText);
  } catch {
    throw new Error('OpenAI returned invalid role outlook JSON.');
  }

  if (!Array.isArray(generated.roles) || generated.roles.length !== ROLE_OUTLOOK_AREAS.length) {
    throw new Error('OpenAI returned an incomplete role outlook.');
  }

  const generatedByCode = new Map(generated.roles.map(role => [String(role.code), role]));
  const roles = ROLE_OUTLOOK_AREAS.map(area => {
    const role = generatedByCode.get(area.code);
    const signal = generatedText(role?.signal, 360);
    const twoMonthOutlook = generatedText(role?.twoMonthOutlook, 420);
    const india = generatedText(role?.india, 360);
    const international = generatedText(role?.international, 360);
    const titles = generatedList(role?.roles, 5, 80);
    const skills = generatedList(role?.skills, 6, 50);
    if (!signal || !twoMonthOutlook || !india || !international || titles.length < 2 || skills.length < 2) {
      throw new Error(`OpenAI returned incomplete details for ${area.name}.`);
    }

    const evidenceIndexes = [...new Set(Array.isArray(role.evidenceIndexes) ? role.evidenceIndexes : [])]
      .filter(index => Number.isInteger(index) && index >= 0 && index < evidenceArticles.length)
      .slice(0, 2);
    const evidence = evidenceIndexes.map(index => {
      const article = evidenceArticles[index];
      return {
        title: article.title,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt
      };
    });

    return {
      ...area,
      signal,
      twoMonthOutlook,
      roles: titles,
      india,
      international,
      skills,
      evidence: evidence.length ? evidence : [ROLE_BASELINE_SOURCE]
    };
  });

  return {
    course: courseKey,
    courseLabel: course.label,
    market: targetMarket,
    data: roles,
    summary: generatedText(generated.summary, 320) || 'AI-generated outlook grounded in recent headlines and workforce research.',
    forecastHorizon: '2 months',
    source: provider,
    model: providerModel,
    generatedAt: new Date().toISOString()
  };
}

app.get('/api/demand-roles', async (req, res) => {
  const courseKey = String(req.query.course || 'cse').toLowerCase();
  const market = String(req.query.market || 'india').toLowerCase() === 'global' ? 'global' : 'india';
  if (!DEMAND_COURSES[courseKey]) return res.status(400).json({ code: 'invalid_course', error: 'Select one of the six supported B.Tech courses.' });
  const forceRefresh = req.query.refresh === 'true';
  const providerConfigured = DEMAND_AI_PROVIDER === 'openai' ? Boolean(OPENAI_API_KEY) : Boolean(GEMINI_API_KEY);
  const cacheKey = `${courseKey}:${market}`;
  if (!providerConfigured) {
    return res.status(503).json({
      code: 'ai_provider_unconfigured',
      error: DEMAND_AI_PROVIDER === 'openai' ? 'OPENAI_API_KEY is missing for the selected provider.' : 'Add a free Gemini API key as GEMINI_API_KEY to enable live course-based demand trends.'
    });
  }
  if (!forceRefresh && demandRolesCache.has(cacheKey) && Date.now() - (demandRolesCacheAt.get(cacheKey) || 0) < ROLE_OUTLOOK_CACHE_MS) {
    return res.json(demandRolesCache.get(cacheKey));
  }
  try {
    if (!demandRolesInFlight.has(cacheKey)) demandRolesInFlight.set(cacheKey, generateDemandRoles(courseKey, market));
    const result = await demandRolesInFlight.get(cacheKey);
    demandRolesCache.set(cacheKey, result);
    demandRolesCacheAt.set(cacheKey, Date.now());
    res.json(result);
  } catch (error) {
    console.error(`AI role outlook failed for ${courseKey}/${market}:`, error.message);
    if (demandRolesCache.has(cacheKey)) return res.json({ ...demandRolesCache.get(cacheKey), stale: true });
    const quotaLimited = /credit|billing|quota|rate limit|resource_exhausted/i.test(error.message);
    const temporarilyBusy = error.status >= 500 || /high demand|overload|temporarily/i.test(error.message);
    res.status(503).json({
      code: quotaLimited ? 'ai_provider_quota_limited' : temporarilyBusy ? 'ai_provider_temporarily_busy' : 'ai_role_outlook_unavailable',
      provider: DEMAND_AI_PROVIDER,
      error: quotaLimited && DEMAND_AI_PROVIDER === 'openai'
        ? 'OpenAI credits are unavailable. Add a free Gemini API key to continue with the no-cost tier.'
        : quotaLimited
          ? 'The Gemini free-tier limit was reached. The saved course baseline remains available; try again after the limit resets.'
          : temporarilyBusy
            ? 'Gemini is temporarily busy. The course baseline remains available while the app retries later.'
            : 'Live course-based role trends could not be generated. Try Refresh outlook again.'
    });
  } finally {
    demandRolesInFlight.delete(cacheKey);
  }
});

app.get('/api/demand-news', async (req, res) => {
  try {
    const result = await getBusinessNews();

    res.json({
      data: cacheNewsArticles(result.data),
      summary: result.summary,
      source: result.source || 'unavailable'
    });
  } catch (error) {
    console.error('Demand news failed:', error);

    res.status(503).json({
      error:
        'Business news could not be loaded right now. Add a valid NEWS_API_KEY to enable live market data.',
      data: []
    });
  }
});

app.get('/api/labor-market', async (req, res) => {
  try {
    const data = await getLaborMarket({ refresh: req.query.refresh === 'true' });
    res.json(data);
  } catch (error) {
    console.error('Labor-market dashboard failed:', error.message);
    res.status(503).json({ error: 'Labor-market data is temporarily unavailable.' });
  }
});

app.get(
  '/api/demand-news/article/:id',
  async (req, res) => {
    const article = newsArticleCache.get(
      req.params.id
    );

    if (!article) {
      return res.status(404).json({
        error:
          'This headline expired. Return to the news feed and open it again.'
      });
    }

    try {
      let publisherUrl = article.url;

      if (
        new URL(publisherUrl).hostname ===
        'news.google.com'
      ) {
        const decoded =
          await googleNewsDecoder.decode(publisherUrl);

        if (
          !decoded.status ||
          !decoded.decoded_url
        ) {
          throw new Error(
            'Could not resolve the publisher URL.'
          );
        }

        publisherUrl = decoded.decoded_url;
      }

      const parsedPublisherUrl = new URL(
        publisherUrl
      );

      if (parsedPublisherUrl.protocol !== 'https:') {
        throw new Error(
          'The publisher URL is not secure.'
        );
      }

      let publisherArticle = null;
      let timeoutId;

      try {
        publisherArticle = await Promise.race([
          extract(publisherUrl).catch(() => null),
          new Promise(resolve => {
            timeoutId = setTimeout(
              () => resolve(null),
              12000
            );
          })
        ]);
      } finally {
        clearTimeout(timeoutId);
      }

      res.json({
        data: {
          ...article,
          url: publisherUrl,
          publisher: parsedPublisherUrl.hostname,
          description:
            publisherArticle?.description ||
            article.description,
          image:
            publisherArticle?.image ||
            article.image
        }
      });
    } catch (error) {
      console.warn(
        'Could not enrich news article:',
        error.message
      );

      res.json({
        data: {
          ...article,
          publisher: article.source,
          description: article.description
        }
      });
    }
  }
);

/* =========================================================
   COMPANY REGISTRATION
========================================================= */

app.post('/api/auth/register', async (req, res) => {
  const name = clean(req.body.companyName);
  const email = clean(req.body.email)?.toLowerCase();
  const password = req.body.password;

  const website = clean(req.body.website) || null;
  const industry = clean(req.body.industry) || 'IT';
  const location = clean(req.body.location) || null;
  const description = clean(req.body.description) || null;

  if (!name || !email || !password) {
    return res.status(400).json({
      error:
        'Company name, work email and password are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters.'
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const r = await pool.query(
      `INSERT INTO companies
       (name,email,password_hash,website,industry,location,description)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,name,email,website,industry,location,description,created_at`,
      [
        name,
        email,
        hash,
        website,
        industry,
        location,
        description
      ]
    );

    const company = r.rows[0];

    res.status(201).json({
      data: {
        company,
        token: issueToken(company)
      }
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        error:
          'A company account already exists for that email.'
      });
    }

    console.error(e);

    res.status(500).json({
      error: 'Could not create the company account.'
    });
  }
});

/* =========================================================
   COMPANY LOGIN
========================================================= */

app.post('/api/auth/login', async (req, res) => {
  const email = clean(req.body.email)?.toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      error:
        'Work email and password are required.'
    });
  }

  try {
    const r = await pool.query(
      `SELECT id,name,email,password_hash,website,industry,location,description,created_at
       FROM companies
       WHERE email=$1`,
      [email]
    );

    const company = r.rows[0];

    if (
      !company ||
      !(await bcrypt.compare(
        password,
        company.password_hash
      ))
    ) {
      return res.status(401).json({
        error:
          'Invalid work email or password.'
      });
    }

    delete company.password_hash;

    res.json({
      data: {
        company,
        token: issueToken(company)
      }
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: 'Could not sign in.'
    });
  }
});

/* =========================================================
   COMPANY PROFILE
========================================================= */

app.get(
  '/api/company/me',
  requireCompany,
  async (req, res) => {
    const r = await pool.query(
      `SELECT id,name,email,website,industry,location,description,created_at
       FROM companies
       WHERE id=$1`,
      [req.company.companyId]
    );

    if (!r.rows[0]) {
      return res.status(404).json({
        error: 'Company account not found.'
      });
    }

    res.json({
      data: r.rows[0]
    });
  }
);

app.patch(
  '/api/company/me',
  requireCompany,
  async (req, res) => {
    const b = req.body;

    if (!clean(b.name)) {
      return res.status(400).json({
        error: 'Company name is required.'
      });
    }

    try {
      const r = await pool.query(
        `UPDATE companies
         SET name=$1,
             website=$2,
             industry=$3,
             location=$4,
             description=$5,
             updated_at=NOW()
         WHERE id=$6
         RETURNING id,name,email,website,industry,location,description,created_at`,
        [
          clean(b.name),
          clean(b.website) || null,
          clean(b.industry) || 'IT',
          clean(b.location) || null,
          clean(b.description) || null,
          req.company.companyId
        ]
      );

      res.json({
        data: r.rows[0]
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not update company profile.'
      });
    }
  }
);

/* =========================================================
   COMPANY JOB MANAGEMENT
========================================================= */

app.get(
  '/api/company/jobs',
  requireCompany,
  async (req, res) => {
    const r = await pool.query(
      `SELECT j.*,
               COALESCE((SELECT ARRAY_AGG(jd.department ORDER BY jd.department) FROM job_departments jd WHERE jd.job_id=j.id), ARRAY[]::text[]) AS eligible_departments,
               (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id=j.id) AS applicant_count
        FROM jobs j
        WHERE j.company_id=$1
        ORDER BY j.created_at DESC`,
      [req.company.companyId]
    );

    res.json({
      data: r.rows
    });
  }
);

app.post(
  '/api/company/jobs',
  requireCompany,
  async (req, res) => {
    const b = req.body;
    const err = validateJob(b);
    if (err) return res.status(400).json({ error: err });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO jobs
         (company_id,title,job_type,salary,stipend,apply_before,visit_date,visit_tag,status,status_class,batch,location,work_mode,description,category,interview_rounds,approval_status,approval_note,reviewed_at,reviewed_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Pending',NULL,NULL,NULL)
         RETURNING *`,
        [
          req.company.companyId, clean(b.title), clean(b.jobType), clean(b.salary) || null, clean(b.stipend) || null,
          b.applyBefore, clean(b.visitDate) || null, clean(b.visitTag) || null, clean(b.status) || 'Eligible',
          clean(b.statusClass) || 'status-amber', clean(b.batch) || null, clean(b.location) || null, clean(b.workMode) || null,
          clean(b.description) || '', clean(b.category) || 'eligible', clean(b.interviewRounds) || 'Not specified'
        ]
      );
      const departments = normalizeEligibleDepartments(b.eligibleDepartments);
      await client.query(
        `INSERT INTO job_departments (job_id,department) SELECT $1, UNNEST($2::text[])`,
        [r.rows[0].id, departments]
      );
      await client.query('COMMIT');
      r.rows[0].eligible_departments = departments;
      res.status(201).json({ data: r.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Failed to publish company job:', {
        message: e?.message,
        code: e?.code,
        detail: e?.detail,
        constraint: e?.constraint,
        table: e?.table,
        column: e?.column
      });
      res.status(500).json({ error: 'Could not publish the job. The server could not save this listing. Please retry; if it continues, contact the administrator.' });
    } finally {
      client.release();
    }
  }
);

app.patch(
  '/api/company/jobs/:id',
  requireCompany,
  async (req, res) => {
    const b = req.body;
    const err = validateJob(b);
    if (err) return res.status(400).json({ error: err });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE jobs
         SET title=$1,job_type=$2,salary=$3,stipend=$4,apply_before=$5,visit_date=$6,visit_tag=$7,
             status=$8,status_class=$9,batch=$10,location=$11,work_mode=$12,category=$13,
             approval_status='Pending',approval_note=NULL,reviewed_at=NULL,reviewed_by=NULL,updated_at=NOW()
         WHERE id=$14 AND company_id=$15
         RETURNING *`,
        [
          clean(b.title),clean(b.jobType),clean(b.salary)||null,clean(b.stipend)||null,b.applyBefore,clean(b.visitDate)||null,
          clean(b.visitTag)||null,clean(b.status)||'Eligible',clean(b.statusClass)||'status-amber',clean(b.batch)||null,
          clean(b.location)||null,clean(b.workMode)||null,clean(b.category)||'eligible',
          req.params.id,req.company.companyId
        ]
      );
      if (!r.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error:'Job not found or you do not own this listing.' });
      }
      const departments = normalizeEligibleDepartments(b.eligibleDepartments);
      await client.query('DELETE FROM job_departments WHERE job_id=$1',[req.params.id]);
      await client.query(
        `INSERT INTO job_departments (job_id,department) SELECT $1, UNNEST($2::text[])`,
        [req.params.id,departments]
      );
      await client.query('COMMIT');
      r.rows[0].eligible_departments = departments;
      res.json({data:r.rows[0]});
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(e);
      res.status(500).json({ error:'Could not update the job.' });
    } finally {
      client.release();
    }
  }
);

/* Configure recruitment rounds only after at least one applicant is shortlisted. */
app.patch('/api/company/jobs/:id/rounds', requireCompany, async (req, res) => {
  const jobId = Number(req.params.id);
  if (!Number.isSafeInteger(jobId) || jobId < 1) return res.status(400).json({ error: 'Invalid job ID.' });
  const raw = req.body?.rounds;
  if (!Array.isArray(raw)) return res.status(400).json({ error: 'Rounds must be provided as a list.' });
  if (raw.length > 10) return res.status(400).json({ error: 'A job can have at most 10 recruitment rounds.' });
  const rounds = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] || {};
    const name = clean(r.name || r.title || `Round ${i + 1}`);
    const type = clean(r.type || 'Online test');
    const mode = clean(r.mode || 'Online');
    const duration = Number(r.duration ?? r.durationMinutes ?? 30);
    const cutoff = Number(String(r.cutoff ?? r.passingScore ?? 60).replace('%', ''));
    const questionCount = /interview|discussion|assignment/i.test(type) ? 0 : Number(r.questionCount ?? r.question_count ?? 10);
    if (!name || name.length > 120) return res.status(400).json({ error: `Round ${i + 1}: provide a name of at most 120 characters.` });
    if (!Number.isFinite(duration) || duration < 5 || duration > 240) return res.status(400).json({ error: `Round ${i + 1}: duration must be between 5 and 240 minutes.` });
    if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 100) return res.status(400).json({ error: `Round ${i + 1}: passing score must be between 0 and 100.` });
    if (!Number.isFinite(questionCount) || questionCount < 0 || questionCount > 100 || (!/interview|discussion|assignment/i.test(type) && questionCount < 1)) return res.status(400).json({ error: `Round ${i + 1}: question count must be between 1 and 100 for tests.` });
    rounds.push({
      name, type, mode, duration, questionCount, cutoff,
      passingScore: `${cutoff}%`, order: i + 1,
      topics: String(r.topics || '').trim().slice(0, 1500),
      instructions: String(r.instructions || '').trim().slice(0, 3000)
    });
  }
  try {
    const job = await pool.query('SELECT id FROM jobs WHERE id=$1 AND company_id=$2', [jobId, req.company.companyId]);
    if (!job.rows[0]) return res.status(404).json({ error: 'Job not found for this company.' });
    const shortlisted = await pool.query("SELECT 1 FROM job_applications WHERE job_id=$1 AND status IN ('Shortlisted','Selected') LIMIT 1", [jobId]);
    if (!shortlisted.rows[0]) return res.status(409).json({ error: 'Shortlist at least one applicant before configuring recruitment rounds.' });
    const saved = await pool.query('UPDATE jobs SET interview_rounds=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING id,title,interview_rounds,updated_at', [JSON.stringify(rounds), jobId, req.company.companyId]);
    res.json({ data: saved.rows[0] });
  } catch (e) {
    console.error('Could not save recruitment rounds:', { message: e?.message, code: e?.code, constraint: e?.constraint });
    res.status(500).json({ error: 'Could not save recruitment rounds. Please retry or check the backend logs.' });
  }
});

app.delete(
  '/api/company/jobs/:id',
  requireCompany,
  async (req, res) => {
    const r = await pool.query(
      `DELETE FROM jobs
       WHERE id=$1 AND company_id=$2
       RETURNING id`,
      [
        req.params.id,
        req.company.companyId
      ]
    );

    if (!r.rows[0]) {
      return res.status(404).json({
        error:
          'Job not found or you do not own this listing.'
      });
    }

    res.status(204).end();
  }
);

/* =========================================================
   PUBLIC JOB ROUTES
========================================================= */

const publicJobSelect = `
  SELECT
    j.id,
    j.company_id,
    c.name AS company_name,
    c.industry,
    c.location AS company_location,
    c.description AS company_description,
    c.website,
    j.title,
    j.job_type,
    j.salary,
    j.stipend,
    j.apply_before,
    j.visit_date,
    j.visit_tag,
    j.status,
    j.status_class,
    j.batch,
    j.location,
    j.work_mode,
    j.description,
    j.category,
    j.interview_rounds,
    COALESCE((SELECT ARRAY_AGG(jd.department ORDER BY jd.department) FROM job_departments jd WHERE jd.job_id=j.id), ARRAY[]::text[]) AS eligible_departments,
    j.created_at,
    j.updated_at
  FROM jobs j
  JOIN companies c ON c.id=j.company_id
`;

/* =========================================================
   ADMIN AUTHENTICATION AND MANAGEMENT
========================================================= */

app.post('/api/admin/login', async (req, res) => {
  const adminId = clean(req.body.adminId);
  const password = req.body.password;

  if (!adminId || !password) {
    return res.status(400).json({ error: 'Admin ID and password are required.' });
  }

  if (ADMIN_KEY && adminId === ADMIN_ID && password === ADMIN_KEY) {
    return res.json({ data: { admin: { id: ADMIN_ID, role: 'Super Admin', name: 'StepUp Administrator' }, token: issueAdminToken() } });
  }
  try {
    const r = await pool.query('SELECT id,admin_id,name,email,password_hash,role FROM admin_users WHERE admin_id=$1 AND active=TRUE', [adminId]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid admin credentials.' });
    const token = jwt.sign({ role: 'admin', adminId: user.admin_id, adminRole: user.role }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ data: { admin: { id: user.admin_id, role: user.role, name: user.name, email: user.email }, token } });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Could not sign in as admin.' }); }
});

const adminStudentSelect = `
  SELECT
    id,name,reg_no,email,must_change_password,profile_completed,
    phone,dob,gender,address,college,degree,department,graduation_year,study_year,cgpa,
    education,skills,languages,experience,achievements,certifications,projects,
    summary,linkedin,github,portfolio,profile_details,created_at,updated_at
  FROM students
`;

function parseAdminArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function parseAdminJson(value, fallback = []) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function logAdminActivity(req, action, entityType = null, entityId = null, details = null) {
  try {
    await pool.query(
      `INSERT INTO admin_activity_logs(admin_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)`,
      [req.admin?.adminId || ADMIN_ID, action, entityType, entityId == null ? null : String(entityId), details]
    );
  } catch (e) {
    console.warn('Could not write admin activity log:', e.message);
  }
}

function adminStudentValues(body) {
  return {
    phone: clean(body.phone) || null,
    dob: clean(body.dob) || null,
    gender: clean(body.gender) || null,
    address: clean(body.address) || null,
    college: clean(body.college) || null,
    degree: clean(body.degree) || null,
    department: clean(body.department) || null,
    graduationYear: body.graduationYear === '' || body.graduationYear === undefined ? null : Number(body.graduationYear),
    studyYear: body.studyYear === '' || body.studyYear === undefined ? null : Number(body.studyYear),
    cgpa: body.cgpa === '' || body.cgpa === undefined ? null : Number(body.cgpa),
    education: parseAdminJson(body.education, []),
    skills: parseAdminArray(body.skills),
    languages: parseAdminArray(body.languages),
    experience: parseAdminJson(body.experience, []),
    achievements: clean(body.achievements) || null,
    certifications: parseAdminJson(body.certifications, []),
    projects: parseAdminJson(body.projects, []),
    summary: clean(body.summary) || null,
    linkedin: clean(body.linkedin) || null,
    github: clean(body.github) || null,
    portfolio: clean(body.portfolio) || null,
    profileDetails: parseAdminJson(body.profileDetails, {})
  };
}


async function adminCrudLog(req, action, type, id, details) { try { await logAdminActivity(req, action, type, id, details); } catch {} }

app.get('/api/admin/drives', requireAdmin, async (_req,res)=>{ try { const r=await pool.query(`SELECT d.*,c.name company_name,j.title job_title FROM placement_drives d LEFT JOIN companies c ON c.id=d.company_id LEFT JOIN jobs j ON j.id=d.job_id ORDER BY d.drive_date NULLS LAST,d.created_at DESC`); res.json({data:r.rows}); } catch(e){console.error(e);res.status(500).json({error:'Could not load placement drives.'});} });
app.post('/api/admin/drives', requireAdmin, async (req,res)=>{ const b=req.body||{}; if(!clean(b.title)) return res.status(400).json({error:'Drive title is required.'}); try { const r=await pool.query(`INSERT INTO placement_drives(title,company_id,job_id,drive_date,eligible_batch,departments,min_cgpa,backlogs_allowed,location,description,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[clean(b.title),b.companyId||null,b.jobId||null,b.driveDate||null,clean(b.eligibleBatch)||null,Array.isArray(b.departments)?b.departments.map(clean).filter(Boolean):[],b.minCgpa?Number(b.minCgpa):null,!!b.backlogsAllowed,clean(b.location)||null,clean(b.description)||null,clean(b.status)||'Upcoming']); await adminCrudLog(req,'Placement drive created','drive',r.rows[0].id,r.rows[0].title); res.status(201).json({data:r.rows[0]}); } catch(e){console.error(e);res.status(500).json({error:'Could not create placement drive.'});} });
app.patch('/api/admin/drives/:id', requireAdmin, async (req,res)=>{ try { const r=await pool.query(`UPDATE placement_drives SET title=COALESCE($1,title),status=COALESCE($2,status),drive_date=COALESCE($3,drive_date),updated_at=NOW() WHERE id=$4 RETURNING *`,[clean(req.body.title)||null,clean(req.body.status)||null,req.body.driveDate||null,req.params.id]); if(!r.rows[0])return res.status(404).json({error:'Drive not found.'}); await adminCrudLog(req,'Placement drive updated','drive',req.params.id,r.rows[0].title); res.json({data:r.rows[0]}); }catch(e){console.error(e);res.status(500).json({error:'Could not update drive.'});} });
app.delete('/api/admin/drives/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('DELETE FROM placement_drives WHERE id=$1 RETURNING id,title',[req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Drive not found.'});await adminCrudLog(req,'Placement drive removed','drive',req.params.id,r.rows[0].title);res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not remove drive.'});}});

app.get('/api/admin/announcements', requireAdmin, async(_req,res)=>{try{const r=await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');res.json({data:r.rows});}catch(e){console.error(e);res.status(500).json({error:'Could not load announcements.'});}});
app.post('/api/admin/announcements', requireAdmin, async(req,res)=>{if(!clean(req.body.title)||!clean(req.body.message))return res.status(400).json({error:'Title and message are required.'});try{const r=await pool.query('INSERT INTO announcements(title,message,audience,published) VALUES($1,$2,$3,$4) RETURNING *',[clean(req.body.title),clean(req.body.message),clean(req.body.audience)||'All',req.body.published!==false]);await adminCrudLog(req,'Announcement published','announcement',r.rows[0].id,r.rows[0].title);res.status(201).json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not create announcement.'});}});
app.patch('/api/admin/announcements/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('UPDATE announcements SET published=COALESCE($1,published),updated_at=NOW() WHERE id=$2 RETURNING *',[typeof req.body.published==='boolean'?req.body.published:null,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Announcement not found.'});res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not update announcement.'});}});
app.delete('/api/admin/announcements/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id,title',[req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Announcement not found.'});await adminCrudLog(req,'Announcement removed','announcement',req.params.id,r.rows[0].title);res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not remove announcement.'});}});

// Student notification feed: published announcements plus approved, eligible jobs.
app.get('/api/student/notifications', requireStudent, async (req, res) => {
  try {
    const studentResult = await pool.query(
      'SELECT department, study_year FROM students WHERE id=$1',
      [req.student.studentId]
    );
    const student = studentResult.rows[0];
    if (!student) return res.status(401).json({ error: 'Student account not found.' });

    const announcementsResult = await pool.query(
      `SELECT id, title, message AS text, created_at
       FROM announcements
       WHERE published=TRUE AND audience IN ('All','Students')
       ORDER BY created_at DESC`
    );

    let jobsResult = { rows: [] };
    if (Number(student.study_year) >= 3) {
      jobsResult = await pool.query(
        `SELECT j.id, j.title, c.name AS company_name, COALESCE(j.reviewed_at,j.created_at) AS created_at
         FROM jobs j
         JOIN companies c ON c.id=j.company_id
         WHERE j.approval_status='Approved'
           AND c.admin_status='Active'
           AND EXISTS (
             SELECT 1 FROM job_departments jd
             WHERE jd.job_id=j.id AND jd.department=$1
           )
         ORDER BY j.created_at DESC`,
        [student.department]
      );
    }

    // Application status changes (Selected/Shortlisted/Waitlisted/Rejected) must
    // notify the matching student and link directly to their existing Progress page.
    const applicationUpdates = await pool.query(
      `SELECT a.id AS application_id, a.status, a.updated_at, j.title AS job_title,
              c.name AS company_name,
              CONCAT('application-', a.id, '-', LOWER(a.status), '-',
                     FLOOR(EXTRACT(EPOCH FROM a.updated_at) * 1000)::BIGINT) AS notification_id
       FROM job_applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN companies c ON c.id=j.company_id
       WHERE a.student_id=$1
         AND a.status IN ('Selected','Shortlisted','Interview','Waitlisted','Rejected')
       ORDER BY a.updated_at DESC`,
      [req.student.studentId]
    );

    const applicationNotifications = applicationUpdates.rows.map(a => {
      const status = String(a.status || '').toLowerCase();
      const labels = {
        selected: ['You have been selected', 'The company selected you for the next stage.'],
        shortlisted: ['You have been shortlisted', 'The company shortlisted your application.'],
        interview: ['Interview stage updated', 'Your application has moved to the interview stage.'],
        waitlisted: ['You are on the waitlist', 'The company placed your application on the waitlist.'],
        rejected: ['Application update', 'The company has updated your application status.']
      };
      const [title, message] = labels[status] || ['Application update', 'Your application status has changed.'];
      return {
        id: a.notification_id,
        type: 'status',
        title: `${title}: ${a.job_title}`,
        text: `${a.company_name} · ${message}`,
        time: a.updated_at,
        goto: 'progress'
      };
    });

    const data = [
      ...announcementsResult.rows.map(a => ({
        id: `announcement-${a.id}`,
        type: 'announcement',
        title: a.title,
        text: a.text,
        time: a.created_at,
        goto: 'home'
      })),
      ...jobsResult.rows.map(j => ({
        id: `job-${j.id}`,
        type: 'job',
        title: `New job: ${j.title}`,
        text: `${j.company_name} has posted a new opportunity.`,
        time: j.created_at,
        goto: 'jobs'
      })),
      ...applicationNotifications
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ data });
  } catch (e) {
    console.error('Could not load student notifications:', e);
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});


app.get('/api/admin/interviews', requireAdmin, async(_req,res)=>{try{const r=await pool.query(`SELECT i.*,s.name student_name,s.reg_no,c.name company_name,j.title job_title FROM interviews i LEFT JOIN students s ON s.id=i.student_id LEFT JOIN companies c ON c.id=i.company_id LEFT JOIN jobs j ON j.id=i.job_id ORDER BY i.interview_date NULLS LAST`);res.json({data:r.rows});}catch(e){console.error(e);res.status(500).json({error:'Could not load interviews.'});}});
app.post('/api/admin/interviews', requireAdmin, async(req,res)=>{const b=req.body||{};if(!b.studentId||!b.interviewDate)return res.status(400).json({error:'Student and interview date are required.'});try{const r=await pool.query('INSERT INTO interviews(student_id,company_id,job_id,interview_date,mode,meeting_link,interviewer,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[b.studentId,b.companyId||null,b.jobId||null,b.interviewDate,clean(b.mode)||'Online',clean(b.meetingLink)||null,clean(b.interviewer)||null,clean(b.notes)||null,clean(b.status)||'Scheduled']);res.status(201).json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not schedule interview.'});}});
app.patch('/api/admin/interviews/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('UPDATE interviews SET status=COALESCE($1,status),notes=COALESCE($2,notes),updated_at=NOW() WHERE id=$3 RETURNING *',[clean(req.body.status)||null,clean(req.body.notes)||null,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Interview not found.'});res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not update interview.'});}});

app.get('/api/admin/admin-users', requireAdmin, async(_req,res)=>{try{const r=await pool.query('SELECT id,admin_id,name,email,role,active,created_at FROM admin_users ORDER BY created_at DESC');res.json({data:r.rows});}catch(e){console.error(e);res.status(500).json({error:'Could not load admin users.'});}});
app.post('/api/admin/admin-users', requireAdmin, async(req,res)=>{const b=req.body||{};if(!clean(b.adminId)||!clean(b.name)||!b.password)return res.status(400).json({error:'Admin ID, name and password are required.'});try{const hash=await bcrypt.hash(b.password,12);const r=await pool.query('INSERT INTO admin_users(admin_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,admin_id,name,email,role,active',[clean(b.adminId),clean(b.name),clean(b.email)||null,hash,clean(b.role)||'Placement Officer']);res.status(201).json({data:r.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({error:'That admin ID already exists.'});console.error(e);res.status(500).json({error:'Could not create admin user.'});}});
app.patch('/api/admin/admin-users/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('UPDATE admin_users SET active=COALESCE($1,active),role=COALESCE($2,role),updated_at=NOW() WHERE id=$3 RETURNING id,admin_id,name,email,role,active',[typeof req.body.active==='boolean'?req.body.active:null,clean(req.body.role)||null,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Admin user not found.'});res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not update admin user.'});}});

app.get('/api/admin/student-resume/:id', requireAdmin, async(req,res)=>{try{const r=await pool.query('SELECT file_name,mime_type,file_data FROM student_resumes WHERE student_id=$1',[req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Resume not found.'});res.setHeader('Content-Type',r.rows[0].mime_type);res.setHeader('Content-Disposition',`inline; filename="${r.rows[0].file_name.replace(/"/g,'')}"`);res.send(r.rows[0].file_data);}catch(e){console.error(e);res.status(500).json({error:'Could not load resume.'});}});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students) AS students,
        (SELECT COUNT(*)::int FROM companies) AS companies,
        (SELECT COUNT(*)::int FROM jobs) AS jobs,
        (SELECT COUNT(*)::int FROM job_applications) AS applications,
        (SELECT COUNT(*)::int FROM students WHERE profile_completed=TRUE) AS completed_profiles,
        (SELECT COUNT(*)::int FROM jobs WHERE apply_before >= CURRENT_DATE) AS active_jobs,
        (SELECT COUNT(*)::int FROM job_applications WHERE status='Selected') AS selected_applications,
        (SELECT COUNT(*)::int FROM companies WHERE admin_status='Active') AS active_companies
    `);
    res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load the admin dashboard.' });
  }
});

app.get('/api/admin/companies', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.id,c.name,c.email,c.website,c.industry,c.location,c.description,c.admin_status,c.created_at,c.updated_at,
             COUNT(DISTINCT j.id)::int AS job_count, COUNT(DISTINCT a.id)::int AS application_count
      FROM companies c
      LEFT JOIN jobs j ON j.company_id=c.id
      LEFT JOIN job_applications a ON a.job_id=j.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);
    res.json({ data: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load companies.' }); }
});

app.patch('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  const status = clean(req.body.status);
  if (!['Active','Suspended'].includes(status)) return res.status(400).json({ error: 'Company status must be Active or Suspended.' });
  try {
    const r = await pool.query(`UPDATE companies SET admin_status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,admin_status`, [status, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Company not found.' });
    await logAdminActivity(req, `Company ${status.toLowerCase()}`, 'company', req.params.id, r.rows[0].name);
    res.json({ data: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update company status.' }); }
});

app.delete('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM companies WHERE id=$1 RETURNING id,name`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Company not found.' });
    await logAdminActivity(req, 'Company removed', 'company', req.params.id, r.rows[0].name);
    res.json({ data: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not remove company.' }); }
});

app.get('/api/admin/jobs', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT j.id,j.company_id,j.title,j.job_type,j.salary,j.stipend,j.apply_before,j.visit_date,j.visit_tag,j.status,j.status_class,j.batch,j.location,j.work_mode,j.description,j.category,j.interview_rounds,j.approval_status,j.approval_note,j.reviewed_at,j.reviewed_by,j.created_at,j.updated_at,
             c.name AS company_name, COALESCE((SELECT ARRAY_AGG(jd.department ORDER BY jd.department) FROM job_departments jd WHERE jd.job_id=j.id), ARRAY[]::text[]) AS eligible_departments, COUNT(a.id)::int AS applicant_count
      FROM jobs j JOIN companies c ON c.id=j.company_id LEFT JOIN job_applications a ON a.job_id=j.id
      GROUP BY j.id,c.name ORDER BY j.created_at DESC
    `);
    res.json({ data: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load jobs.' }); }
});

app.patch('/api/admin/jobs/:id', requireAdmin, async (req, res) => {
  const approvalStatus = clean(req.body.approvalStatus);
  try {
    if (approvalStatus !== undefined) {
      if (!['Approved', 'Rejected', 'Pending'].includes(approvalStatus)) {
        return res.status(400).json({ error: 'Approval status must be Approved, Rejected, or Pending.' });
      }
      const note = clean(req.body.approvalNote) || null;
      if (approvalStatus === 'Rejected' && !note) {
        return res.status(400).json({ error: 'Please provide a reason when rejecting a job.' });
      }
      const reviewer = req.admin?.adminId || 'admin';
      const r = await pool.query(
        `UPDATE jobs SET approval_status=$1,approval_note=$2,reviewed_at=NOW(),reviewed_by=$3,updated_at=NOW()
         WHERE id=$4
         RETURNING id,title,company_id,approval_status,approval_note,reviewed_at,reviewed_by`,
        [approvalStatus, note, reviewer, req.params.id]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Job not found.' });
      await logAdminActivity(req, `Job ${approvalStatus.toLowerCase()}`, 'job', req.params.id, `${r.rows[0].title}${note ? ` — ${note}` : ''}`);
      return res.json({ data: r.rows[0] });
    }

    const status = clean(req.body.status);
    if (!status) return res.status(400).json({ error: 'Job status is required.' });
    const r = await pool.query(`UPDATE jobs SET status=$1,status_class=$2,updated_at=NOW() WHERE id=$3 RETURNING id,title,status,status_class`, [status, clean(req.body.statusClass)||'status-amber', req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Job not found.' });
    await logAdminActivity(req, 'Job status updated', 'job', req.params.id, `${r.rows[0].title}: ${status}`);
    res.json({ data: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update job.' }); }
});

app.delete('/api/admin/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM jobs WHERE id=$1 RETURNING id,title`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Job not found.' });
    await logAdminActivity(req, 'Job removed', 'job', req.params.id, r.rows[0].title);
    res.json({ data: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not remove job.' }); }
});

app.get('/api/admin/applications', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.id,a.job_id,a.student_id,a.status,a.applied_at,a.updated_at,j.title AS job_title,c.name AS company_name,s.name AS student_name,s.reg_no,s.email
      FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id JOIN students s ON s.id=a.student_id
      ORDER BY a.applied_at DESC
    `);
    res.json({ data: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load applications.' }); }
});

app.patch('/api/admin/applications/:id', requireAdmin, async (req, res) => {
  const status = clean(req.body.status);
  const allowed = ['Applied','Selected','Rejected','Waitlisted','Shortlisted','Interview'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}.` });
  try {
    const r = await pool.query(`UPDATE job_applications SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status`, [status, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Application not found.' });
    await logAdminActivity(req, 'Application status updated', 'application', req.params.id, status);
    res.json({ data: r.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update application.' }); }
});

app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
  try {
    const [dept,apps,companies,jobs] = await Promise.all([
      pool.query(`SELECT COALESCE(NULLIF(department,''),'Not specified') AS label, COUNT(*)::int AS value FROM students GROUP BY 1 ORDER BY value DESC LIMIT 10`),
      pool.query(`SELECT status AS label, COUNT(*)::int AS value FROM job_applications GROUP BY status ORDER BY value DESC`),
      pool.query(`SELECT c.name AS label, COUNT(a.id)::int AS value FROM companies c LEFT JOIN jobs j ON j.company_id=c.id LEFT JOIN job_applications a ON a.job_id=j.id GROUP BY c.id ORDER BY value DESC LIMIT 8`),
      pool.query(`SELECT TO_CHAR(month_start,'Mon YYYY') AS label, COUNT(*)::int AS value FROM (SELECT date_trunc('month',created_at) AS month_start FROM jobs) m GROUP BY month_start ORDER BY month_start DESC LIMIT 8`)
    ]);
    res.json({ data: { departments: dept.rows, applications: apps.rows, companies: companies.rows, jobsByMonth: jobs.rows.reverse() } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load analytics.' }); }
});

app.get('/api/admin/activity', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id,admin_id,action,entity_type,entity_id,details,created_at FROM admin_activity_logs ORDER BY created_at DESC LIMIT 50`);
    res.json({ data: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load activity log.' }); }
});

app.get('/api/admin/students', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`${adminStudentSelect} ORDER BY created_at DESC`);
    res.json({ data: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load students.' });
  }
});

app.get('/api/admin/students/:id', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`${adminStudentSelect} WHERE id=$1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Student not found.' });
    res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load the student.' });
  }
});

app.post('/api/admin/students', requireAdmin, async (req, res) => {
  const name = clean(req.body.name);
  const regNo = clean(req.body.regNo);
  const email = clean(req.body.email)?.toLowerCase();
  if (!name || !regNo || !email) return res.status(400).json({ error: 'Name, registration number and email are required.' });

  const password = clean(req.body.password) || randomPassword();
  const v = adminStudentValues(req.body);
  if (!Number.isInteger(v.studyYear) || v.studyYear < 1 || v.studyYear > 4) return res.status(400).json({ error: 'Please select a valid current year.' });
  if (v.graduationYear !== null && Number.isNaN(v.graduationYear)) return res.status(400).json({ error: 'Graduation year must be a valid number.' });
  if (v.cgpa !== null && Number.isNaN(v.cgpa)) return res.status(400).json({ error: 'CGPA must be a valid number.' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(
      `INSERT INTO students
       (name,reg_no,email,password_hash,must_change_password,phone,dob,gender,address,college,degree,department,graduation_year,study_year,cgpa,education,skills,languages,experience,achievements,certifications,projects,summary,linkedin,github,portfolio,profile_details)
       VALUES($1,$2,$3,$4,TRUE,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::text[],$17::text[],$18::jsonb,$19,$20::jsonb,$21::jsonb,$22,$23,$24,$25,$26::jsonb)
       RETURNING id,name,reg_no,email,department,study_year,graduation_year,must_change_password,profile_completed`,
      [name,regNo,email,hash,v.phone,v.dob,v.gender,v.address,v.college,v.degree,v.department,v.graduationYear,v.studyYear,v.cgpa,JSON.stringify(v.education),v.skills,v.languages,JSON.stringify(v.experience),v.achievements,JSON.stringify(v.certifications),JSON.stringify(v.projects),v.summary,v.linkedin,v.github,v.portfolio,JSON.stringify(v.profileDetails)]
    );
    await logAdminActivity(req, 'Student created', 'student', r.rows[0].id, `${r.rows[0].name} (${r.rows[0].reg_no})`);
    res.status(201).json({ data: { student: r.rows[0], temporaryPassword: password } });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A student already exists with that registration number or email.' });
    console.error(e);
    res.status(500).json({ error: 'Could not create the student account.' });
  }
});

app.patch('/api/admin/students/:id', requireAdmin, async (req, res) => {
  const name = clean(req.body.name);
  const regNo = clean(req.body.regNo);
  const email = clean(req.body.email)?.toLowerCase();
  if (!name || !regNo || !email) return res.status(400).json({ error: 'Name, registration number and email are required.' });

  const v = adminStudentValues(req.body);
  if (!Number.isInteger(v.studyYear) || v.studyYear < 1 || v.studyYear > 4) return res.status(400).json({ error: 'Please select a valid current year.' });
  if (v.graduationYear !== null && Number.isNaN(v.graduationYear)) return res.status(400).json({ error: 'Graduation year must be a valid number.' });
  if (v.cgpa !== null && Number.isNaN(v.cgpa)) return res.status(400).json({ error: 'CGPA must be a valid number.' });

  try {
    const r = await pool.query(
      `UPDATE students SET
        name=$1,reg_no=$2,email=$3,phone=$4,dob=$5,gender=$6,address=$7,college=$8,degree=$9,department=$10,graduation_year=$11,study_year=$12,cgpa=$13,
        education=$14::jsonb,skills=$15::text[],languages=$16::text[],experience=$17::jsonb,achievements=$18,certifications=$19::jsonb,projects=$20::jsonb,
        summary=$21,linkedin=$22,github=$23,portfolio=$24,profile_details=$25::jsonb,updated_at=NOW()
       WHERE id=$26
       RETURNING id,name,reg_no,email,department,study_year,graduation_year,must_change_password,profile_completed`,
      [name,regNo,email,v.phone,v.dob,v.gender,v.address,v.college,v.degree,v.department,v.graduationYear,v.studyYear,v.cgpa,JSON.stringify(v.education),v.skills,v.languages,JSON.stringify(v.experience),v.achievements,JSON.stringify(v.certifications),JSON.stringify(v.projects),v.summary,v.linkedin,v.github,v.portfolio,JSON.stringify(v.profileDetails),req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Student not found.' });
    res.json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Another student already uses that registration number or email.' });
    console.error(e);
    res.status(500).json({ error: 'Could not update the student.' });
  }
});

app.delete('/api/admin/students/:id', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM students WHERE id=$1 RETURNING id,name,reg_no', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Student not found.' });
    await logAdminActivity(req, 'Student removed', 'student', req.params.id, `${r.rows[0].name} (${r.rows[0].reg_no})`);
    res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not delete the student.' });
  }
});

/* =========================================================
   STUDENT LOGIN
========================================================= */

app.post(
  '/api/student/login',
  async (req, res) => {
    const regNo = clean(req.body.regNo);
    const password = req.body.password;

    if (!regNo || !password) {
      return res.status(400).json({
        error:
          'Registration number and password are required.'
      });
    }

    try {
      const r = await pool.query(
        `SELECT id,name,reg_no,email,password_hash,study_year,department,graduation_year,must_change_password,profile_completed
         FROM students
         WHERE reg_no=$1`,
        [regNo]
      );

      const student = r.rows[0];

      if (
        !student ||
        !(await bcrypt.compare(
          password,
          student.password_hash
        ))
      ) {
        return res.status(401).json({
          error:
            'Invalid registration number or password.'
        });
      }

      delete student.password_hash;

      res.json({
        data: {
          student,
          token: issueStudentToken(student)
        }
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not sign in.'
      });
    }
  }
);

/* =========================================================
   STUDENT PROFILE: GET
========================================================= */

app.get(
  '/api/student/me',
  requireStudent,
  async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT
          id,name,reg_no,email,
          must_change_password,profile_completed,
          phone,dob,gender,address,college,
          degree,department,graduation_year,cgpa,
          education,skills,languages,experience,
          achievements,certifications,projects,
          summary,linkedin,github,portfolio,
          profile_details,created_at,updated_at
         FROM students
         WHERE id=$1`,
        [req.student.studentId]
      );

      if (!r.rows[0]) {
        return res.status(404).json({
          error: 'Student account not found.'
        });
      }

      res.json({
        data: r.rows[0]
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not load student profile.'
      });
    }
  }
);

/* =========================================================
   STUDENT PROFILE: UPDATE
========================================================= */

app.put(
  '/api/student/profile',
  requireStudent,
  async (req, res) => {
    const b = req.body;

    if (
      !clean(b.name) ||
      !clean(b.regNo) ||
      !clean(b.email) ||
      !clean(b.degree) ||
      !clean(b.department)
    ) {
      return res.status(400).json({
        error:
          'Name, registration number, email, degree and department are required.'
      });
    }

    try {
      const r = await pool.query(
        `UPDATE students SET
          name=$1,
          reg_no=$2,
          email=$3,
          phone=$4,
          dob=$5,
          gender=$6,
          address=$7,
          college=$8,
          degree=$9,
          department=$10,
          graduation_year=$11,
          cgpa=$12,
          education=$13::jsonb,
          skills=$14::text[],
          languages=$15::text[],
          experience=$16::jsonb,
          achievements=$17,
          certifications=$18::jsonb,
          projects=$19::jsonb,
          summary=$20,
          linkedin=$21,
          github=$22,
          portfolio=$23,
          profile_details=$24::jsonb,
          profile_completed=TRUE,
          updated_at=NOW()
         WHERE id=$25
         RETURNING id,name,reg_no,email,must_change_password,profile_completed`,
        [
          clean(b.name),
          clean(b.regNo),
          clean(b.email).toLowerCase(),
          clean(b.phone) || null,
          clean(b.dob) || null,
          clean(b.gender) || null,
          clean(b.address) || null,
          clean(b.college) || null,
          clean(b.degree),
          clean(b.department),
          b.graduationYear
            ? Number(b.graduationYear)
            : null,
          b.cgpa
            ? Number(b.cgpa)
            : null,
          JSON.stringify(
            Array.isArray(b.education)
              ? b.education
              : []
          ),
          Array.isArray(b.skills)
            ? b.skills.map(clean).filter(Boolean)
            : [],
          Array.isArray(b.languages)
            ? b.languages.map(clean).filter(Boolean)
            : [],
          JSON.stringify(
            Array.isArray(b.experience)
              ? b.experience
              : []
          ),
          clean(b.achievements) || null,
          JSON.stringify(
            Array.isArray(b.certifications)
              ? b.certifications
              : []
          ),
          JSON.stringify(
            Array.isArray(b.projects)
              ? b.projects
              : []
          ),
          clean(b.summary) || null,
          clean(b.linkedin) || null,
          clean(b.github) || null,
          clean(b.portfolio) || null,
          JSON.stringify(b.profileDetails && typeof b.profileDetails === 'object' ? b.profileDetails : {}),
          req.student.studentId
        ]
      );

      res.json({
        data: r.rows[0]
      });
    } catch (e) {
      if (e.code === '23505') {
        return res.status(409).json({
          error:
            'That registration number or email is already in use.'
        });
      }

      console.error(e);

      res.status(500).json({
        error: 'Could not save student profile.'
      });
    }
  }
);

/* =========================================================
   STUDENT CHANGE PASSWORD
========================================================= */

app.post(
  '/api/student/change-password',
  requireStudent,
  async (req, res) => {
    const current = req.body.currentPassword;
    const next = req.body.newPassword;

    if (!current || !next) {
      return res.status(400).json({
        error:
          'Current and new passwords are required.'
      });
    }

    if (String(next).length < 8) {
      return res.status(400).json({
        error:
          'New password must be at least 8 characters.'
      });
    }

    try {
      const r = await pool.query(
        `SELECT password_hash
         FROM students
         WHERE id=$1`,
        [req.student.studentId]
      );

      if (
        !r.rows[0] ||
        !(await bcrypt.compare(
          current,
          r.rows[0].password_hash
        ))
      ) {
        return res.status(401).json({
          error: 'Current password is incorrect.'
        });
      }

      const hash = await bcrypt.hash(next, 12);

      await pool.query(
        `UPDATE students
         SET password_hash=$1,
             must_change_password=FALSE,
             updated_at=NOW()
         WHERE id=$2`,
        [
          hash,
          req.student.studentId
        ]
      );

      res.json({
        data: {
          message:
            'Password changed successfully.'
        }
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not change password.'
      });
    }
  }
);

/* =========================================================
   FORGOT PASSWORD: REQUEST OTP
========================================================= */

app.post(
  '/api/student/forgot-password/request',
  async (req, res) => {
    const regNo = clean(req.body.regNo);

    if (!regNo) {
      return res.status(400).json({
        error:
          'Registration number is required.'
      });
    }

    try {
      const r = await pool.query(
        `SELECT id,name,email
         FROM students
         WHERE reg_no=$1`,
        [regNo]
      );

      // Do not reveal whether the registration number exists.
      if (!r.rows[0]) {
        return res.json({
          data: {
            message:
              'If the registration number belongs to a StepUp student account, an OTP has been sent to the registered email.'
          }
        });
      }

      const student = r.rows[0];

      const otp = randomOtp();
      const hash = await bcrypt.hash(otp, 10);

      await pool.query(
        `UPDATE password_reset_otps
         SET used=TRUE
         WHERE student_id=$1 AND used=FALSE`,
        [student.id]
      );

      await pool.query(
        `INSERT INTO password_reset_otps
         (student_id,otp_hash,expires_at)
         VALUES($1,$2,NOW()+INTERVAL '10 minutes')`,
        [
          student.id,
          hash
        ]
      );

      await sendResetEmail({
        to: student.email,
        name: student.name,
        otp
      });

      res.json({
        data: {
          message:
            'If the registration number belongs to a StepUp student account, an OTP has been sent to the registered email.'
        }
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error:
          'Could not process the password reset request.'
      });
    }
  }
);

/* =========================================================
   FORGOT PASSWORD: RESET PASSWORD
========================================================= */

app.post(
  '/api/student/forgot-password/reset',
  async (req, res) => {
    const regNo = clean(req.body.regNo);
    const otp = clean(req.body.otp);
    const newPassword = req.body.newPassword;

    if (!regNo || !otp || !newPassword) {
      return res.status(400).json({
        error:
          'Registration number, OTP and new password are required.'
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        error:
          'New password must be at least 8 characters.'
      });
    }

    try {
      const s = await pool.query(
        `SELECT id
         FROM students
         WHERE reg_no=$1`,
        [regNo]
      );

      if (!s.rows[0]) {
        return res.status(400).json({
          error: 'Invalid or expired OTP.'
        });
      }

      const r = await pool.query(
        `SELECT id,otp_hash
         FROM password_reset_otps
         WHERE student_id=$1
           AND used=FALSE
           AND expires_at>NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [s.rows[0].id]
      );

      if (
        !r.rows[0] ||
        !(await bcrypt.compare(
          otp,
          r.rows[0].otp_hash
        ))
      ) {
        return res.status(400).json({
          error: 'Invalid or expired OTP.'
        });
      }

      const hash = await bcrypt.hash(
        newPassword,
        12
      );

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE students
           SET password_hash=$1,
               must_change_password=FALSE,
               updated_at=NOW()
           WHERE id=$2`,
          [
            hash,
            s.rows[0].id
          ]
        );

        await client.query(
          `UPDATE password_reset_otps
           SET used=TRUE
           WHERE id=$1`,
          [r.rows[0].id]
        );

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      res.json({
        data: {
          message:
            'Password reset successfully. You can now sign in.'
        }
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not reset the password.'
      });
    }
  }
);

/* =========================================================
   STUDENT JOB APPLICATIONS
========================================================= */

app.get('/api/student/applications', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id,a.job_id,a.status,a.applied_at,a.updated_at,
              j.title,j.job_type,j.salary,j.stipend,j.apply_before,j.location,j.work_mode,j.interview_rounds,
              c.id AS company_id,c.name AS company_name,c.industry,c.location AS company_location,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',aa.id,'round_index',aa.round_index,'round_name',aa.round_name,'status',aa.status,'score',aa.score,'correct_count',aa.correct_count,'total_questions',aa.total_questions,'violation_count',aa.violation_count,'auto_submitted',aa.auto_submitted,'company_verified',aa.company_verified,'company_decision',aa.company_decision,'submitted_at',aa.submitted_at) ORDER BY aa.round_index) FROM assessment_attempts aa WHERE aa.application_id=a.id AND aa.student_id=a.student_id),'[]'::jsonb) AS assessment_attempts
       FROM job_applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN companies c ON c.id=j.company_id
       WHERE a.student_id=$1
       ORDER BY a.applied_at DESC`,
      [req.student.studentId]
    );
    res.json({ data: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load your applications.' });
  }
});

app.post('/api/jobs/:id/apply', requireStudent, async (req, res) => {
  try {
    const job = await pool.query(
      `SELECT j.id,j.title,j.apply_before FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=$1 AND j.approval_status='Approved' AND c.admin_status='Active'`,
      [req.params.id]
    );
    if (!job.rows[0]) return res.status(404).json({ error: 'Job listing not found.' });

    const studentInfo = await pool.query('SELECT department,study_year FROM students WHERE id=$1',[req.student.studentId]);
    if (!studentInfo.rows[0]) return res.status(401).json({error:'Student account not found.'});
    if (Number(studentInfo.rows[0].study_year) < 3) return res.status(403).json({error:'Jobs unlock from 3rd year.'});
    const eligibility = await pool.query('SELECT 1 FROM job_departments WHERE job_id=$1 AND department=$2',[req.params.id,studentInfo.rows[0].department]);
    if (!eligibility.rows[0]) return res.status(403).json({error:'You are not eligible for this job based on your department.'});

    const deadline = job.rows[0].apply_before;
    const today = new Date().toISOString().slice(0, 10);
    if (deadline && String(deadline).slice(0, 10) < today) {
      return res.status(400).json({ error: 'The application deadline has passed.' });
    }

    const resume = await pool.query(
      `SELECT 1 FROM student_resumes WHERE student_id=$1`,
      [req.student.studentId]
    );
    if (!resume.rows[0]) {
      return res.status(400).json({
        error: 'Please upload your PDF resume from your Student Profile before applying.'
      });
    }

    const r = await pool.query(
      `INSERT INTO job_applications (job_id,student_id,status)
       VALUES($1,$2,'Applied')
       ON CONFLICT(job_id,student_id) DO NOTHING
       RETURNING id,job_id,student_id,status,applied_at`,
      [req.params.id, req.student.studentId]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'You have already applied to this job.' });
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not submit your application.' });
  }
});

app.delete('/api/jobs/:id/apply', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM job_applications
       WHERE job_id=$1 AND student_id=$2
       RETURNING id,job_id,student_id`,
      [req.params.id, req.student.studentId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'You have not applied to this job.' });
    res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not withdraw your application.' });
  }
});

app.get('/api/student/resume', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT file_name,mime_type,uploaded_at FROM student_resumes WHERE student_id=$1`,
      [req.student.studentId]
    );
    res.json({ data: r.rows[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load resume information.' });
  }
});

app.post('/api/student/resume', requireStudent, async (req, res) => {
  const fileName = clean(req.body.fileName);
  const mimeType = clean(req.body.mimeType);
  let encoded = clean(req.body.data);

  if (!fileName || !encoded) return res.status(400).json({ error: 'A PDF resume is required.' });
  if (mimeType !== 'application/pdf' || !/\.pdf$/i.test(fileName)) {
    return res.status(400).json({ error: 'Resume must be a PDF file.' });
  }

  encoded = encoded.replace(/^data:application\/pdf;base64,/i, '');
  let fileData;
  try { fileData = Buffer.from(encoded, 'base64'); }
  catch { return res.status(400).json({ error: 'The uploaded PDF could not be read.' }); }

  if (!fileData.length || fileData.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Resume PDF must be smaller than 10 MB.' });
  }

  if (fileData.subarray(0, 5).toString() !== '%PDF-') {
    return res.status(400).json({ error: 'The selected file is not a valid PDF.' });
  }

  try {
    await pool.query(
      `INSERT INTO student_resumes(student_id,file_name,mime_type,file_data,uploaded_at)
       VALUES($1,$2,$3,$4,NOW())
       ON CONFLICT(student_id)
       DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,
                     file_data=EXCLUDED.file_data,uploaded_at=NOW()`,
      [req.student.studentId, fileName, mimeType, fileData]
    );
    res.json({ data: { file_name: fileName, mime_type: mimeType, size: fileData.length } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save the uploaded resume.' });
  }
});

app.get('/api/student/resume/download', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT file_name,mime_type,file_data FROM student_resumes WHERE student_id=$1`,
      [req.student.studentId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No resume has been uploaded.' });
    const row = r.rows[0];
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name).replace(/["\r\n]/g, '_')}"`);
    res.send(row.file_data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not download your resume.' });
  }
});

const RESUME_AI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overallScore: { type: 'INTEGER' },
    atsScore: { type: 'INTEGER' },
    contentScore: { type: 'INTEGER' },
    skillsScore: { type: 'INTEGER' },
    projectsScore: { type: 'INTEGER' },
    vocabularyScore: { type: 'INTEGER' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    mistakes: {
      type: 'ARRAY', items: { type: 'OBJECT', properties: {
        type: { type: 'STRING' }, original: { type: 'STRING' }, suggestion: { type: 'STRING' }, explanation: { type: 'STRING' }
      }, required: ['type','original','suggestion','explanation'] }
    },
    vocabulary: {
      type: 'OBJECT', properties: {
        weakWords: { type: 'ARRAY', items: { type: 'STRING' } },
        betterAlternatives: { type: 'ARRAY', items: { type: 'STRING' } },
        notes: { type: 'ARRAY', items: { type: 'STRING' } }
      }, required: ['weakWords','betterAlternatives','notes']
    },
    detectedSkills: { type: 'ARRAY', items: { type: 'STRING' } },
    skillSuggestions: { type: 'ARRAY', items: { type: 'STRING' } },
    projects: {
      type: 'ARRAY', items: { type: 'OBJECT', properties: {
        name: { type: 'STRING' }, score: { type: 'INTEGER' }, domains: { type: 'ARRAY', items: { type: 'STRING' } }, suggestion: { type: 'STRING' }
      }, required: ['name','score','domains','suggestion'] }
    },
    domainSuggestions: { type: 'ARRAY', items: { type: 'STRING' } },
    sectionFeedback: {
      type: 'ARRAY', items: { type: 'OBJECT', properties: {
        section: { type: 'STRING' }, status: { type: 'STRING' }, feedback: { type: 'STRING' }
      }, required: ['section','status','feedback'] }
    },
    summary: { type: 'STRING' }
  },
  required: ['overallScore','atsScore','contentScore','skillsScore','projectsScore','vocabularyScore','strengths','mistakes','vocabulary','detectedSkills','skillSuggestions','projects','domainSuggestions','sectionFeedback','summary']
};

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function normalizeResumeAnalysis(a) {
  return {
    ...a,
    overallScore: clampScore(a.overallScore), atsScore: clampScore(a.atsScore), contentScore: clampScore(a.contentScore),
    skillsScore: clampScore(a.skillsScore), projectsScore: clampScore(a.projectsScore), vocabularyScore: clampScore(a.vocabularyScore),
    strengths: generatedList(a.strengths, 8, 500),
    mistakes: Array.isArray(a.mistakes) ? a.mistakes.slice(0, 20).map(x => ({
      type: generatedText(x?.type, 80), original: generatedText(x?.original, 500), suggestion: generatedText(x?.suggestion, 500), explanation: generatedText(x?.explanation, 500)
    })) : [],
    vocabulary: {
      weakWords: generatedList(a.vocabulary?.weakWords, 20, 80),
      betterAlternatives: generatedList(a.vocabulary?.betterAlternatives, 20, 120),
      notes: generatedList(a.vocabulary?.notes, 10, 500)
    },
    detectedSkills: generatedList(a.detectedSkills, 40, 100),
    skillSuggestions: generatedList(a.skillSuggestions, 20, 250),
    projects: Array.isArray(a.projects) ? a.projects.slice(0, 15).map(x => ({
      name: generatedText(x?.name, 180), score: clampScore(x?.score), domains: generatedList(x?.domains, 10, 100), suggestion: generatedText(x?.suggestion, 600)
    })) : [],
    domainSuggestions: generatedList(a.domainSuggestions, 20, 300),
    sectionFeedback: Array.isArray(a.sectionFeedback) ? a.sectionFeedback.slice(0, 20).map(x => ({ section: generatedText(x?.section, 100), status: generatedText(x?.status, 50), feedback: generatedText(x?.feedback, 600) })) : [],
    summary: generatedText(a.summary, 1200)
  };
}

async function analyzeResumeWithGemini(pdfBuffer, profile) {
  if (!GEMINI_API_KEY) throw new Error('AI is not configured. Add GEMINI_API_KEY to BACKEND/.env.');
  const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];
  const profileContext = {
    name: profile.name, department: profile.department, degree: profile.degree, studyYear: profile.study_year,
    cgpa: profile.cgpa, skills: profile.skills, projects: profile.projects, experience: profile.experience,
    certifications: profile.certifications, summary: profile.summary
  };
  const prompt = `Analyze the attached student's actual resume PDF for a college placement portal. Do not invent facts, achievements, metrics, skills, technologies, employers, projects, or qualifications. Score only what is supported by the resume. This is a general resume-quality analysis, NOT a job eligibility decision. Do not use resume score to decide which jobs the student can see.\n\nStudent profile context (use only as context and flag mismatches rather than inventing resume content): ${JSON.stringify(profileContext)}\n\nScoring guidance: ATS score should reflect machine readability, standard sections, clear formatting, contact information, headings, and keyword clarity. Content score should reflect specificity, action verbs, measurable evidence when present, and relevance. Vocabulary score should reflect grammar, spelling, clarity, repetition, and professional wording. Projects score should reflect technical clarity, technologies, contribution, and impact evidence. Overall score should be a balanced assessment of the resume.\n\nFor mistakes, quote only short snippets from the resume and provide a correction. If a recommendation depends on a skill that is not actually evidenced, phrase it as a suggestion to add it only if the student genuinely used it. Give department/domain suggestions based on the student's actual department and evidence in the resume. Return only the requested JSON.`;
  const inlineData = { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') };
  let lastError;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'You are a careful resume reviewer. Analyze the supplied PDF itself. Never fabricate facts. Return valid JSON matching the schema.' }] },
          contents: [{ parts: [{ text: prompt }, { inlineData }] }],
          generationConfig: { temperature: 0.15, responseMimeType: 'application/json', responseSchema: RESUME_AI_RESPONSE_SCHEMA, maxOutputTokens: 7000 }
        }), signal: AbortSignal.timeout(60000)
      });
      const payload = await response.json();
      if (!response.ok) { const e = new Error(payload.error?.message || `Gemini returned ${response.status}`); e.status = response.status; throw e; }
      const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
      if (!text) throw new Error('Gemini returned no resume analysis.');
      return normalizeResumeAnalysis(JSON.parse(text));
    } catch (e) { lastError = e; if (model === models[models.length - 1]) throw lastError; }
  }
  throw lastError || new Error('Resume analysis failed.');
}

app.get('/api/student/resume', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT file_name,mime_type,uploaded_at FROM student_resumes WHERE student_id=$1`,
      [req.student.studentId]
    );
    res.json({ data: r.rows[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load resume information.' });
  }
});

app.post('/api/student/resume', requireStudent, async (req, res) => {
  const fileName = clean(req.body.fileName);
  const mimeType = clean(req.body.mimeType);
  let encoded = clean(req.body.data);

  if (!fileName || !encoded) return res.status(400).json({ error: 'A PDF resume is required.' });
  if (mimeType !== 'application/pdf' || !/\.pdf$/i.test(fileName)) {
    return res.status(400).json({ error: 'Resume must be a PDF file.' });
  }

  encoded = encoded.replace(/^data:application\/pdf;base64,/i, '');
  let fileData;
  try { fileData = Buffer.from(encoded, 'base64'); }
  catch { return res.status(400).json({ error: 'The uploaded PDF could not be read.' }); }

  if (!fileData.length || fileData.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Resume PDF must be smaller than 10 MB.' });
  }

  if (fileData.subarray(0, 5).toString() !== '%PDF-') {
    return res.status(400).json({ error: 'The selected file is not a valid PDF.' });
  }

  try {
    await pool.query(
      `INSERT INTO student_resumes(student_id,file_name,mime_type,file_data,uploaded_at)
       VALUES($1,$2,$3,$4,NOW())
       ON CONFLICT(student_id)
       DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,
                     file_data=EXCLUDED.file_data,uploaded_at=NOW()`,
      [req.student.studentId, fileName, mimeType, fileData]
    );
    res.json({ data: { file_name: fileName, mime_type: mimeType, size: fileData.length } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save the uploaded resume.' });
  }
});

app.get('/api/student/resume/download', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT file_name,mime_type,file_data FROM student_resumes WHERE student_id=$1`,
      [req.student.studentId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No resume has been uploaded.' });
    const row = r.rows[0];
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name).replace(/["\r\n]/g, '_')}"`);
    res.send(row.file_data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not download your resume.' });
  }
});

app.get('/api/student/resume/analysis', requireStudent, async (req, res) => {
  try {
    const r = await pool.query(`SELECT resume_file_name,resume_uploaded_at,analysis,analyzed_at FROM resume_ai_analysis WHERE student_id=$1`, [req.student.studentId]);
    res.json({ data: r.rows[0] || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load resume analysis.' }); }
});

app.post('/api/student/resume/analyze', requireStudent, async (req, res) => {
  try {
    const resume = await pool.query(`SELECT file_name,mime_type,file_data,uploaded_at FROM student_resumes WHERE student_id=$1`, [req.student.studentId]);
    if (!resume.rows[0]) return res.status(404).json({ error: 'Upload a resume before asking AI to analyze it.' });
    if (resume.rows[0].mime_type !== 'application/pdf') return res.status(400).json({ error: 'Only PDF resumes can be analyzed right now.' });
    const profile = await pool.query(`SELECT name,department,degree,study_year,cgpa,skills,projects,experience,certifications,summary FROM students WHERE id=$1`, [req.student.studentId]);
    if (!profile.rows[0]) return res.status(404).json({ error: 'Student profile not found.' });
    const analysis = await analyzeResumeWithGemini(resume.rows[0].file_data, profile.rows[0]);
    await pool.query(`INSERT INTO resume_ai_analysis(student_id,resume_file_name,resume_uploaded_at,analysis,analyzed_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(student_id) DO UPDATE SET resume_file_name=EXCLUDED.resume_file_name,resume_uploaded_at=EXCLUDED.resume_uploaded_at,analysis=EXCLUDED.analysis,analyzed_at=NOW()`, [req.student.studentId, resume.rows[0].file_name, resume.rows[0].uploaded_at, analysis]);
    res.json({ data: { file_name: resume.rows[0].file_name, analyzed_at: new Date().toISOString(), analysis } });
  } catch (e) {
    console.error('Resume AI analysis failed:', e);
    const status = e.status === 429 ? 429 : 500;
    res.status(status).json({ error: status === 429 ? 'The AI service is busy or rate-limited. Please try again shortly.' : (e.message || 'Could not analyze the resume.') });
  }
});

/* =========================================================
   SECURE STUDENT ASSESSMENTS — recruitment round engine
   Server owns attempts, deadlines, answer keys and scoring.
========================================================= */
function parseConfiguredRounds(raw) {
  if (Array.isArray(raw)) return raw.map((r,i)=>typeof r==='string'?{name:r}:({...r,name:r.name||r.title||r.roundName||`Round ${i+1}`}));
  const text=String(raw||'').trim(); if(!text||text==='Not specified') return [];
  try { const parsed=JSON.parse(text); if(Array.isArray(parsed))return parseConfiguredRounds(parsed); if(parsed&&Array.isArray(parsed.rounds))return parseConfiguredRounds(parsed.rounds); } catch {}
  return text.split(/\r?\n/).map(x=>x.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean).map(name=>({name}));
}
function assessmentDurationSeconds(round) {
  const raw=round.durationMinutes??round.duration_minutes??round.duration;
  let v=Number(raw);
  if(!Number.isFinite(v)){const match=String(raw||'').match(/(\d+(?:\.\d+)?)/);v=match?Number(match[1]):NaN;if(match&&/hour|hr/i.test(String(raw)))v*=60;}
  if(Number.isFinite(v)&&v>0) return Math.min(120,Math.max(5,v))*60;
  return 30*60;
}
function fallbackAssessmentQuestions(topics, roundName, requestedCount=10) {
  const bank=[
    {topic:'Quantitative aptitude',question:'A product costs ₹800 and is discounted by 15%. What is the sale price?',options:['₹620','₹680','₹700','₹720'],correctIndex:1,explanation:'15% of 800 is 120; 800 − 120 = 680.'},
    {topic:'Logical reasoning',question:'Find the next number: 3, 6, 12, 24, __',options:['30','36','42','48'],correctIndex:3,explanation:'Each number is multiplied by 2.'},
    {topic:'Programming fundamentals',question:'Which structure follows Last In, First Out (LIFO)?',options:['Queue','Stack','Graph','Hash table'],correctIndex:1,explanation:'A stack removes the most recently added item first.'},
    {topic:'Programming fundamentals',question:'What is the purpose of a function in a program?',options:['To group reusable instructions','To increase screen brightness','To store only images','To replace the operating system'],correctIndex:0,explanation:'Functions package logic for reuse and clearer structure.'},
    {topic:'Data structures',question:'Which data structure is commonly used for first-in, first-out processing?',options:['Stack','Queue','Tree','Set'],correctIndex:1,explanation:'Queues process the earliest inserted item first.'},
    {topic:'SQL',question:'Which SQL clause filters rows before grouping?',options:['ORDER BY','WHERE','HAVING','LIMIT'],correctIndex:1,explanation:'WHERE filters rows before GROUP BY.'},
    {topic:'Computer science',question:'Which HTTP status code usually means a request succeeded?',options:['200','301','403','500'],correctIndex:0,explanation:'200 OK indicates a successful request.'},
    {topic:'Problem solving',question:'If 5 workers finish a task in 12 days at the same rate, how many worker-days are required?',options:['17','30','60','72'],correctIndex:3,explanation:'5 × 12 = 60 worker-days.'},
    {topic:'JavaScript',question:'Which keyword declares a block-scoped variable that can be reassigned?',options:['const','let','static','define'],correctIndex:1,explanation:'let declares a reassignable block-scoped variable.'},
    {topic:'Professional practice',question:'What is the best first step when a test question is unclear?',options:['Guess without reading','Ask for clarification if allowed by the rules','Open another tab to search','Share the question with others'],correctIndex:1,explanation:'Follow the assessment instructions and request clarification when permitted.'}
  ];
  const seed=(String(topics||'')+' '+String(roundName||'')).toLowerCase();
  let filtered=bank.filter(q=>q.topic.toLowerCase().split(' ').some(w=>w.length>3&&seed.includes(w)));
  if(filtered.length<5) filtered=bank;
  const count=Math.max(1,Math.min(100,Number(requestedCount)||10));return Array.from({length:count},(_,i)=>({...filtered[i%filtered.length],id:`q${i+1}`}));
}
async function generateAssessmentQuestions(round, job) {
  const topics=String(round.topics||round.skills||round.description||round.instructions||job.requirements||job.description||job.title||'general aptitude');
  const questionCount=Math.max(1,Math.min(100,Number(round.questionCount??round.question_count??10)||10));
  if(GEMINI_API_KEY) {
    try {
      const prompt=`Create exactly ${questionCount} original multiple-choice questions for a student placement assessment. Job role: ${job.title}. Round: ${round.name}. Topics: ${topics}. Keep difficulty moderate and questions unambiguous. Each question must have exactly four options and one correctIndex (0-3). Do not include personal data, unsafe content, or answers in the question text. Return JSON array only with keys topic, question, options, correctIndex, explanation.`;
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.35,responseMimeType:'application/json',maxOutputTokens:5000}}),signal:AbortSignal.timeout(25000)});
      const payload=await response.json();
      if(response.ok){const text=payload.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';const parsed=JSON.parse(text);if(Array.isArray(parsed)){const valid=parsed.filter(q=>q&&typeof q.question==='string'&&Array.isArray(q.options)&&q.options.length===4&&Number.isInteger(Number(q.correctIndex))&&Number(q.correctIndex)>=0&&Number(q.correctIndex)<=3).slice(0,questionCount);if(valid.length>=Math.min(5,questionCount))return valid.map((q,i)=>({...q,id:`q${i+1}`,correctIndex:Number(q.correctIndex)}));}}
    } catch(e) { console.warn('AI question generation failed; using fallback question set:',e.message); }
  }
  return fallbackAssessmentQuestions(topics,round.name,questionCount);
}
function publicQuestions(questions) { return questions.map(({id,topic,question,options})=>({id,topic,question,options})); }
async function scoreAssessmentAttempt(attemptId, studentId, forceAuto=false) {
  const found=await pool.query('SELECT * FROM assessment_attempts WHERE id=$1 AND student_id=$2',[attemptId,studentId]);
  const a=found.rows[0]; if(!a) return null;
  if(a.status==='submitted') return {score:a.score,correctCount:a.correct_count,totalQuestions:a.total_questions,autoSubmitted:a.auto_submitted};
  const questions=Array.isArray(a.questions)?a.questions:[]; const answers=a.answers&&typeof a.answers==='object'?a.answers:{};
  let correct=0; for(const q of questions) if(Number(answers[q.id])===Number(q.correctIndex)) correct++;
  const score=questions.length?Math.round(correct/questions.length*100):0;
  const updated=await pool.query(`UPDATE assessment_attempts SET status='submitted',submitted_at=NOW(),score=$3,correct_count=$4,total_questions=$5,auto_submitted=$6 WHERE id=$1 AND student_id=$2 RETURNING score,correct_count,total_questions,auto_submitted`,[attemptId,studentId,score,correct,questions.length,Boolean(forceAuto)]);
  return updated.rows[0]||null;
}

app.post('/api/student/assessments/prepare', requireStudent, async (req,res)=>{
  try {
    const appId=Number(req.body.applicationId), roundIndex=Number(req.body.roundIndex);
    const r=await pool.query(`SELECT a.id,a.status,j.title,j.description,j.requirements,j.interview_rounds,c.name AS company_name,s.skills,s.department,s.degree,s.cgpa,s.projects,s.summary FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id JOIN students s ON s.id=a.student_id WHERE a.id=$1 AND a.student_id=$2`,[appId,req.student.studentId]);
    const row=r.rows[0]; if(!row)return res.status(404).json({error:'Application not found.'});
    if(!['selected','shortlisted','interview'].includes(String(row.status).toLowerCase()))return res.status(403).json({error:'Preparation unlocks after shortlisting or selection.'});
    const rounds=parseConfiguredRounds(row.interview_rounds), round=rounds[roundIndex]; if(!round)return res.status(404).json({error:'Recruitment round not found.'});
    const topics=String(round.topics||round.skills||round.description||row.description||row.title);
    let tasks=[`Review the fundamentals of ${topics}.`,`Complete 20 practice questions related to ${round.name}.`,'Practise explaining your reasoning aloud.','Review your mistakes and retry similar questions.'];
    let summary=`Prepare for ${round.name} by focusing on ${topics}. Use timed practice and review each incorrect answer.`;
    if(GEMINI_API_KEY){try{const prompt=`Create a concise student preparation plan in JSON for a placement round. Role: ${row.title}; round: ${round.name}; topics: ${topics}; student skills: ${JSON.stringify(row.skills||[])}. Return {"summary":"...","tasks":["..." x 4-6]}. Do not invent student credentials or guarantee selection.`;const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.3,responseMimeType:'application/json',maxOutputTokens:1200}}),signal:AbortSignal.timeout(15000)});const p=await response.json();if(response.ok){const text=p.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';const plan=JSON.parse(text);if(plan.summary)summary=plan.summary;if(Array.isArray(plan.tasks))tasks=plan.tasks.slice(0,7);}}catch(e){console.warn('AI prep plan fallback:',e.message);}}
    res.json({data:{title:`${round.name} preparation plan`,summary,tasks,aiGenerated:Boolean(GEMINI_API_KEY)}});
  } catch(e){console.error(e);res.status(500).json({error:'Could not prepare this round.'});}
});

app.post('/api/student/assessments/start', requireStudent, async (req,res)=>{
  try {
    const applicationId=Number(req.body.applicationId), roundIndex=Number(req.body.roundIndex);
    if(!Number.isSafeInteger(applicationId)||applicationId<1||!Number.isInteger(roundIndex)||roundIndex<0)return res.status(400).json({error:'Invalid application or round.'});
    const r=await pool.query(`SELECT a.id,a.status,j.title,j.description,j.requirements,j.interview_rounds FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND a.student_id=$2`,[applicationId,req.student.studentId]);
    const row=r.rows[0]; if(!row)return res.status(404).json({error:'Application not found.'});
    if(!['selected','shortlisted','interview'].includes(String(row.status).toLowerCase()))return res.status(403).json({error:'The company must shortlist or select you before you can start an assessment.'});
    const rounds=parseConfiguredRounds(row.interview_rounds), round=rounds[roundIndex]; if(!round)return res.status(404).json({error:'Round configuration was not found.'});
    if(!/aptitude|coding|programming|assessment|online test|written test|quiz|technical test|mcq/i.test(`${round.name} ${round.type||round.mode||''}`))return res.status(400).json({error:'This round is not configured as an online assessment. The recruiter will schedule it.'});
    if(roundIndex>0){const prior=await pool.query(`SELECT status,score,company_verified,company_decision FROM assessment_attempts WHERE application_id=$1 AND student_id=$2 AND round_index=$3`,[applicationId,req.student.studentId,roundIndex-1]);const requiredScore=Number(String(rounds[roundIndex-1].cutoff??rounds[roundIndex-1].passingScore??rounds[roundIndex-1].passing_score??60).replace('%',''));if(!prior.rows[0]||prior.rows[0].status!=='submitted'||Number(prior.rows[0].score)<requiredScore||prior.rows[0].company_verified!==true||prior.rows[0].company_decision!=='Pass')return res.status(403).json({error:`The previous round must be passed and verified by the company before this assessment unlocks. Required score: ${requiredScore}%.`});}
    const existing=await pool.query('SELECT * FROM assessment_attempts WHERE application_id=$1 AND student_id=$2 AND round_index=$3',[applicationId,req.student.studentId,roundIndex]);
    if(existing.rows[0]){const a=existing.rows[0];if(a.status==='submitted')return res.status(409).json({error:'This round has already been submitted. Retakes must be enabled by the recruiter.'});if(new Date(a.expires_at)<=new Date()){const result=await scoreAssessmentAttempt(a.id,req.student.studentId,true);return res.status(409).json({error:'Your previous attempt expired and was submitted automatically.',result});}const remaining=Math.max(1,Math.floor((new Date(a.expires_at)-Date.now())/1000));return res.json({data:{attemptId:a.id,roundName:a.round_name,questions:publicQuestions(a.questions),remainingSeconds:remaining,violationCount:a.violation_count,resumed:true}});}
    const questions=await generateAssessmentQuestions(round,row);
    const duration=assessmentDurationSeconds(round);
    const inserted=await pool.query(`INSERT INTO assessment_attempts(application_id,student_id,round_index,round_name,questions,answers,status,started_at,expires_at,duration_seconds,violation_count) VALUES($1,$2,$3,$4,$5::jsonb,'{}'::jsonb,'in_progress',NOW(),NOW()+($6 * INTERVAL '1 second'),$6,0) RETURNING id,expires_at,violation_count`,[applicationId,req.student.studentId,roundIndex,round.name,JSON.stringify(questions),duration]);
    const a=inserted.rows[0];res.status(201).json({data:{attemptId:a.id,roundName:round.name,questions:publicQuestions(questions),remainingSeconds:duration,expiresAt:a.expires_at,violationCount:0,strictMode:true}});
  } catch(e){if(e.code==='23505')return res.status(409).json({error:'An attempt already exists for this round. Refresh the Progress page.'});console.error(e);res.status(500).json({error:'Could not start assessment.'});}
});

app.put('/api/student/assessments/:id/answer', requireStudent, async(req,res)=>{
  try{const id=Number(req.params.id),questionId=String(req.body.questionId||''),answerIndex=Number(req.body.answerIndex);if(!Number.isSafeInteger(id)||!questionId||!Number.isInteger(answerIndex)||answerIndex<0||answerIndex>3)return res.status(400).json({error:'Invalid answer.'});const r=await pool.query(`UPDATE assessment_attempts SET answers=jsonb_set(answers,ARRAY[$3],to_jsonb($4::int),true) WHERE id=$1 AND student_id=$2 AND status='in_progress' AND expires_at>NOW() AND EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q WHERE q->>'id'=$3 AND jsonb_array_length(q->'options')>$4) RETURNING id,expires_at`,[id,req.student.studentId,questionId,answerIndex]);if(!r.rows[0])return res.status(409).json({error:'Attempt expired, submitted, or answer is invalid.'});res.json({data:{saved:true,expiresAt:r.rows[0].expires_at}});}catch(e){console.error(e);res.status(500).json({error:'Could not save answer.'});}
});

app.post('/api/student/assessments/:id/violation', requireStudent, async(req,res)=>{
  try{const id=Number(req.params.id),reason=String(req.body.reason||'Integrity event').slice(0,180);const r=await pool.query(`UPDATE assessment_attempts SET violation_count=violation_count+1, integrity_events=integrity_events || jsonb_build_array(jsonb_build_object('reason',$3::text,'at',NOW())), updated_at=NOW() WHERE id=$1 AND student_id=$2 AND status='in_progress' AND expires_at>NOW() RETURNING violation_count`,[id,req.student.studentId,reason]);if(!r.rows[0])return res.status(404).json({error:'Active attempt not found.'});const count=r.rows[0].violation_count;let result=null;if(count>=3)result=await scoreAssessmentAttempt(id,req.student.studentId,true);res.json({data:{violationCount:count,autoSubmitted:count>=3,result}});}catch(e){console.error(e);res.status(500).json({error:'Could not record integrity event.'});}
});

app.post('/api/student/assessments/:id/submit', requireStudent, async(req,res)=>{
  try{const id=Number(req.params.id);const check=await pool.query('SELECT id,status,expires_at FROM assessment_attempts WHERE id=$1 AND student_id=$2',[id,req.student.studentId]);const a=check.rows[0];if(!a)return res.status(404).json({error:'Assessment attempt not found.'});if(a.status==='submitted'){const prev=await pool.query('SELECT score,correct_count,total_questions,auto_submitted FROM assessment_attempts WHERE id=$1',[id]);return res.json({data:prev.rows[0]});}const expired=new Date(a.expires_at)<=new Date();if(!expired&&req.body.answers&&typeof req.body.answers==='object'){const detail=await pool.query('SELECT questions FROM assessment_attempts WHERE id=$1 AND student_id=$2',[id,req.student.studentId]);const qs=Array.isArray(detail.rows[0]?.questions)?detail.rows[0].questions:[];const safe={};for(const q of qs){const v=req.body.answers[q.id];if(Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<(q.options||[]).length)safe[q.id]=Number(v);}if(Object.keys(safe).length){await pool.query("UPDATE assessment_attempts SET answers=answers || $3::jsonb WHERE id=$1 AND student_id=$2 AND status='in_progress'", [id,req.student.studentId,JSON.stringify(safe)]);}}const result=await scoreAssessmentAttempt(id,req.student.studentId,Boolean(req.body.autoSubmitted)||expired);if(!result)return res.status(409).json({error:'Could not submit this attempt.'});res.json({data:result});}catch(e){console.error(e);res.status(500).json({error:'Could not submit assessment.'});}
});

app.get('/api/student/assessments/:id/result', requireStudent, async(req,res)=>{try{const r=await pool.query(`SELECT id,round_name,status,score,correct_count,total_questions,violation_count,auto_submitted,started_at,submitted_at FROM assessment_attempts WHERE id=$1 AND student_id=$2`,[Number(req.params.id),req.student.studentId]);if(!r.rows[0])return res.status(404).json({error:'Result not found.'});if(r.rows[0].status!=='submitted')return res.status(409).json({error:'This assessment has not been submitted.'});res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not load assessment result.'});}});

/* =========================================================
   COMPANY ROUND VERIFICATION — recruiter approves each submitted test
========================================================= */
app.get('/api/company/jobs/:id/assessments', requireCompany, async (req,res)=>{
  try {
    const job=await pool.query('SELECT id FROM jobs WHERE id=$1 AND company_id=$2',[req.params.id,req.company.companyId]);
    if(!job.rows[0])return res.status(404).json({error:'Job not found for this company.'});
    const r=await pool.query(`SELECT aa.id AS attempt_id,aa.application_id,aa.student_id,aa.round_index,aa.round_name,aa.status,aa.score,aa.correct_count,aa.total_questions,aa.violation_count,aa.auto_submitted,aa.company_verified,aa.company_decision,aa.company_feedback,aa.company_verified_at,aa.submitted_at,s.name AS student_name,s.email,a.status AS application_status FROM assessment_attempts aa JOIN job_applications a ON a.id=aa.application_id JOIN students s ON s.id=aa.student_id JOIN jobs j ON j.id=a.job_id WHERE j.id=$1 AND j.company_id=$2 AND aa.status='submitted' ORDER BY aa.submitted_at DESC`,[req.params.id,req.company.companyId]);
    res.json({data:r.rows});
  }catch(e){console.error(e);res.status(500).json({error:'Could not load submitted assessments.'});}
});
app.patch('/api/company/assessments/:id/verify', requireCompany, async(req,res)=>{
  const decision=String(req.body.decision||'');
  const feedback=clean(req.body.feedback)||null;
  if(!['Pass','Fail','Needs review'].includes(decision))return res.status(400).json({error:'Choose Pass, Fail or Needs review.'});
  try{
    const r=await pool.query(`UPDATE assessment_attempts aa SET company_verified=($1<>'Needs review'),company_decision=$1,company_feedback=$2,company_verified_at=CASE WHEN $1='Needs review' THEN NULL ELSE NOW() END,updated_at=NOW() FROM job_applications a,jobs j WHERE aa.id=$3 AND aa.application_id=a.id AND a.job_id=j.id AND j.company_id=$4 AND aa.status='submitted' RETURNING aa.id AS attempt_id,aa.application_id,aa.round_index,aa.round_name,aa.score,aa.company_verified,aa.company_decision,aa.company_feedback,aa.company_verified_at`,[decision,feedback,req.params.id,req.company.companyId]);
    if(!r.rows[0])return res.status(404).json({error:'Submitted assessment not found for your company.'});
    res.json({data:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not save round verification.'});}
});

/* =========================================================
   COMPANY APPLICANT MANAGEMENT
========================================================= */

app.get('/api/company/jobs/:id/applications', requireCompany, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id AS application_id,a.job_id,a.status,a.applied_at,a.updated_at,
              j.title AS job_title,
              s.id AS student_id,s.name,s.reg_no,s.email,s.phone,s.college,s.degree,s.department,
              s.graduation_year,s.cgpa,s.education,s.skills,s.languages,s.experience,
              s.achievements,s.certifications,s.projects,s.summary,s.linkedin,s.github,s.portfolio,s.profile_details,
              sr.file_name AS resume_file_name,sr.mime_type AS resume_mime_type,sr.uploaded_at AS resume_uploaded_at
       FROM job_applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN students s ON s.id=a.student_id
       LEFT JOIN student_resumes sr ON sr.student_id=s.id
       WHERE a.job_id=$1 AND j.company_id=$2
       ORDER BY a.applied_at DESC`,
      [req.params.id, req.company.companyId]
    );
    res.json({ data: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load applicants for this job.' });
  }
});

app.patch('/api/company/applications/:id', requireCompany, async (req, res) => {
  const status = clean(req.body.status);
  if (!['Applied','Shortlisted','Selected','Rejected','Waitlisted'].includes(status)) {
    return res.status(400).json({ error: 'Application status must be Applied, Shortlisted, Selected, Rejected or Waitlisted.' });
  }
  try {
    const r = await pool.query(
      `UPDATE job_applications a
       SET status=$1,updated_at=NOW()
       FROM jobs j
       WHERE a.id=$2 AND a.job_id=j.id AND j.company_id=$3
       RETURNING a.id,a.job_id,a.student_id,a.status,a.updated_at`,
      [status, req.params.id, req.company.companyId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Application not found for your company.' });
    res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update the application status.' });
  }
});

app.get('/api/company/applications/:id/resume', requireCompany, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sr.file_name,sr.mime_type,sr.file_data
       FROM student_resumes sr
       JOIN job_applications a ON a.student_id=sr.student_id
       JOIN jobs j ON j.id=a.job_id
       WHERE a.id=$1 AND j.company_id=$2`,
      [req.params.id, req.company.companyId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No uploaded PDF resume is available for this applicant.' });
    const row = r.rows[0];
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name).replace(/["\r\n]/g, '_')}"`);
    res.send(row.file_data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not download the student resume.' });
  }
});

/* =========================================================
   PUBLIC JOB LIST
========================================================= */

app.get('/api/jobs', requireStudent, async (req, res) => {
  try {
    let where = '';
    const params = [];
    const student = await pool.query('SELECT department,study_year FROM students WHERE id=$1',[req.student.studentId]);
    if (!student.rows[0]) return res.status(401).json({error:'Student account not found.'});
    if (Number(student.rows[0].study_year) < 3) return res.status(403).json({error:'Jobs unlock from 3rd year.'});
    params.push(student.rows[0].department);
    where = " WHERE j.approval_status='Approved' AND c.admin_status='Active' AND EXISTS (SELECT 1 FROM job_departments jd WHERE jd.job_id=j.id AND jd.department=$1)";
    const r = await pool.query(`${publicJobSelect}${where} ORDER BY j.created_at DESC`, params);

    res.json({
      data: r.rows
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: 'Could not load jobs.'
    });
  }
});

/* =========================================================
   PUBLIC JOB DETAILS
========================================================= */

app.get('/api/jobs/:id', requireStudent, async (req, res) => {
  try {
    const params = [req.params.id];
    let where = " WHERE j.id=$1 AND j.approval_status='Approved' AND c.admin_status='Active'";
    const student = await pool.query('SELECT department,study_year FROM students WHERE id=$1',[req.student.studentId]);
    if (!student.rows[0]) return res.status(401).json({error:'Student account not found.'});
    if (Number(student.rows[0].study_year) < 3) return res.status(403).json({error:'Jobs unlock from 3rd year.'});
    params.push(student.rows[0].department);
    where += ' AND EXISTS (SELECT 1 FROM job_departments jd WHERE jd.job_id=j.id AND jd.department=$2)';
    const r = await pool.query(`${publicJobSelect}${where}`, params);

    if (!r.rows[0]) {
      return res.status(404).json({
        error: 'Job listing not found.'
      });
    }

    res.json({
      data: r.rows[0]
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: 'Could not load the job listing.'
    });
  }
});
app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

/* =========================================================
   START SERVER
========================================================= */

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `StepUp API running on http://localhost:${PORT}`
      );
    });
  })
  .catch(err => {
    console.error(
      'Database/schema setup failed:',
      err
    );

    process.exit(1);
  });
