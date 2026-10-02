import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { XMLParser } from 'fast-xml-parser';
import { extract } from '@extractus/article-extractor';
import { GoogleDecoder } from 'google-news-url-decoder';
import { randomUUID } from 'node:crypto';
import { getLaborMarket } from './labor-market.js';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;
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

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(s => s.trim())
    : true
}));

app.use(express.json({ limit: '15mb' }));

const clean = v => typeof v === 'string' ? v.trim() : v;
const newsArticleCache = new Map();
const googleNewsDecoder = new GoogleDecoder();
let demandRolesCache = null;
let demandRolesCacheAt = 0;
let demandRolesInFlight = null;

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

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY || req.get('x-admin-key') !== ADMIN_KEY) {
    return res.status(403).json({
      error: 'Admin authorization required.'
    });
  }

  next();
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
  const required = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing SMTP configuration: ${missing.join(', ')}`
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'StepUp Password Reset OTP',
    text: `Hello ${name},

Your StepUp password reset OTP is:

${otp}

This OTP expires in 10 minutes.

If you did not request a password reset, you can ignore this email.

StepUp`
  });

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
    'applyBefore',
    'description',
    'interviewRounds'
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

    CREATE TABLE IF NOT EXISTS student_resumes (
      student_id BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/* =========================================================
   HEALTH CHECK
========================================================= */

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
const ROLE_OUTLOOK_AREAS = [
  { code: '01', name: 'AI, data & automation' },
  { code: '02', name: 'Cybersecurity & digital trust' },
  { code: '03', name: 'Healthcare & health technology' },
  { code: '04', name: 'Commerce, supply chain & logistics' },
  { code: '05', name: 'Clean energy & sustainability' }
];

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

async function generateDemandRoles() {
  const news = await getBusinessNews();
  if (!news.data.length) throw new Error('No recent news is available to ground the role outlook.');

  const evidenceArticles = NEWS_SECTIONS.flatMap(section =>
    news.data.filter(article => article.category === section.category).slice(0, 5)
  );
  const evidenceContext = evidenceArticles.map((article, index) => ({
    index,
    category: article.category,
    title: article.title,
    publisher: article.source,
    publishedAt: article.publishedAt,
    description: String(article.description || '').slice(0, 450)
  }));

  const prompt = {
    task: 'Create a student-facing current demand overview and two-month career outlook for India and international markets.',
    asOf: new Date().toISOString(),
    rules: [
      'Return JSON only with keys summary and roles.',
      'Return exactly one role object for each supplied area, keeping its code and name unchanged.',
      'Each role object needs code, name, signal, twoMonthOutlook, roles, india, international, skills, and evidenceIndexes.',
      'Use recent headlines as evidence, not as proof of hiring volume. Do not invent statistics, salaries, vacancies, or guarantees.',
      'Write twoMonthOutlook as a cautious qualitative forecast for the next two months from the asOf date. Focus on near-term hiring signals supported by the supplied recent headlines; state uncertainty and do not present long-term trends as short-term evidence.',
      'If evidence does not support a role-specific two-month prediction, say that the signal is too limited instead of inventing one.',
      'Explain concrete employer use cases and entry-level or early-career job titles. Keep each field concise and understandable to a student.',
      'Use only evidenceIndexes that refer to supplied headlines and are relevant to that role. Use an empty array when the headlines do not support a specific claim; the app will show its baseline research source.',
      'Distinguish India-specific signals from overseas signals. Do not imply a country-wide shortage based on one story.'
    ],
    areas: ROLE_OUTLOOK_AREAS,
    baseline: ROLE_BASELINE_SOURCE,
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
    data: roles,
    summary: generatedText(generated.summary, 320) || 'AI-generated outlook grounded in recent headlines and workforce research.',
    forecastHorizon: '2 months',
    source: provider,
    model: providerModel,
    generatedAt: new Date().toISOString()
  };
}

app.get('/api/demand-roles', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const providerConfigured = DEMAND_AI_PROVIDER === 'openai'
    ? Boolean(OPENAI_API_KEY)
    : Boolean(GEMINI_API_KEY);
  if (!providerConfigured) {
    return res.status(503).json({
      code: 'ai_provider_unconfigured',
      error: DEMAND_AI_PROVIDER === 'openai'
        ? 'OPENAI_API_KEY is missing for the selected provider.'
        : 'Add a free Gemini API key as GEMINI_API_KEY to enable AI role outlooks.'
    });
  }

  if (!forceRefresh && demandRolesCache && Date.now() - demandRolesCacheAt < ROLE_OUTLOOK_CACHE_MS) {
    return res.json(demandRolesCache);
  }

  try {
    if (!demandRolesInFlight) demandRolesInFlight = generateDemandRoles();
    const result = await demandRolesInFlight;
    demandRolesCache = result;
    demandRolesCacheAt = Date.now();
    res.json(result);
  } catch (error) {
    console.error('AI role outlook failed:', error.message);
    if (demandRolesCache) return res.json({ ...demandRolesCache, stale: true });
    const quotaLimited = /credit|billing|quota|rate limit|resource_exhausted/i.test(error.message);
    const temporarilyBusy = error.status >= 500 || /high demand|overload|temporarily/i.test(error.message);
    const provider = DEMAND_AI_PROVIDER;
    res.status(503).json({
      code: quotaLimited
        ? 'ai_provider_quota_limited'
        : temporarilyBusy ? 'ai_provider_temporarily_busy' : 'ai_role_outlook_unavailable',
      provider,
      error: quotaLimited && provider === 'openai'
        ? 'OpenAI credits are unavailable. Add a free Gemini API key to continue with the no-cost tier.'
        : quotaLimited
          ? 'The Gemini free-tier limit was reached. The saved research baseline remains available; try again after the limit resets.'
          : temporarilyBusy
            ? 'Gemini is temporarily busy. The research baseline remains available while the app retries later.'
            : 'AI role outlook could not be generated. The research baseline remains available.'
    });
  } finally {
    demandRolesInFlight = null;
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

    if (err) {
      return res.status(400).json({
        error: err
      });
    }

    try {
      const r = await pool.query(
        `INSERT INTO jobs
         (company_id,title,job_type,salary,stipend,apply_before,visit_date,visit_tag,status,status_class,batch,location,work_mode,description,category,interview_rounds)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          req.company.companyId,
          clean(b.title),
          clean(b.jobType),
          clean(b.salary) || null,
          clean(b.stipend) || null,
          b.applyBefore,
          clean(b.visitDate) || null,
          clean(b.visitTag) || null,
          clean(b.status) || 'Eligible',
          clean(b.statusClass) || 'status-amber',
          clean(b.batch) || null,
          clean(b.location) || null,
          clean(b.workMode) || null,
          clean(b.description),
          clean(b.category) || 'eligible',
          clean(b.interviewRounds)
        ]
      );

      res.status(201).json({
        data: r.rows[0]
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not publish the job.'
      });
    }
  }
);

app.patch(
  '/api/company/jobs/:id',
  requireCompany,
  async (req, res) => {
    const b = req.body;
    const err = validateJob(b);

    if (err) {
      return res.status(400).json({
        error: err
      });
    }

    try {
      const r = await pool.query(
        `UPDATE jobs
         SET title=$1,
             job_type=$2,
             salary=$3,
             stipend=$4,
             apply_before=$5,
             visit_date=$6,
             visit_tag=$7,
             status=$8,
             status_class=$9,
             batch=$10,
             location=$11,
             work_mode=$12,
             description=$13,
             category=$14,
             interview_rounds=$15,
             updated_at=NOW()
         WHERE id=$16 AND company_id=$17
         RETURNING *`,
        [
          clean(b.title),
          clean(b.jobType),
          clean(b.salary) || null,
          clean(b.stipend) || null,
          b.applyBefore,
          clean(b.visitDate) || null,
          clean(b.visitTag) || null,
          clean(b.status) || 'Eligible',
          clean(b.statusClass) || 'status-amber',
          clean(b.batch) || null,
          clean(b.location) || null,
          clean(b.workMode) || null,
          clean(b.description),
          clean(b.category) || 'eligible',
          clean(b.interviewRounds),
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

      res.json({
        data: r.rows[0]
      });
    } catch (e) {
      console.error(e);

      res.status(500).json({
        error: 'Could not update the job.'
      });
    }
  }
);

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
    j.created_at,
    j.updated_at
  FROM jobs j
  JOIN companies c ON c.id=j.company_id
`;

/* =========================================================
   ADMIN: CREATE STUDENT
========================================================= */

app.post(
  '/api/admin/students',
  requireAdmin,
  async (req, res) => {
    const name = clean(req.body.name);
    const regNo = clean(req.body.regNo);
    const email = clean(req.body.email)?.toLowerCase();

    if (!name || !regNo || !email) {
      return res.status(400).json({
        error:
          'Name, registration number and email are required.'
      });
    }

    const password =
      clean(req.body.password) || randomPassword();

    try {
      const hash = await bcrypt.hash(password, 12);

      const r = await pool.query(
        `INSERT INTO students
         (name,reg_no,email,password_hash,must_change_password)
         VALUES($1,$2,$3,$4,TRUE)
         RETURNING id,name,reg_no,email,must_change_password`,
        [
          name,
          regNo,
          email,
          hash
        ]
      );

      res.status(201).json({
        data: {
          student: r.rows[0],
          temporaryPassword: password
        }
      });
    } catch (e) {
      if (e.code === '23505') {
        return res.status(409).json({
          error:
            'A student already exists with that registration number or email.'
        });
      }

      console.error(e);

      res.status(500).json({
        error: 'Could not create the student account.'
      });
    }
  }
);

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
        `SELECT id,name,reg_no,email,password_hash,must_change_password,profile_completed
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
              c.id AS company_id,c.name AS company_name,c.industry,c.location AS company_location
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
      `SELECT id,title,apply_before FROM jobs WHERE id=$1`,
      [req.params.id]
    );
    if (!job.rows[0]) return res.status(404).json({ error: 'Job listing not found.' });

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
  if (!['Applied','Selected','Rejected','Waitlisted'].includes(status)) {
    return res.status(400).json({ error: 'Application status must be Applied, Selected, Rejected or Waitlisted.' });
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

app.get('/api/jobs', async (_req, res) => {
  try {
    const r = await pool.query(
      `${publicJobSelect}
       ORDER BY j.created_at DESC`
    );

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

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `${publicJobSelect}
       WHERE j.id=$1`,
      [req.params.id]
    );

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