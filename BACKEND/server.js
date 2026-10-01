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

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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

app.use(express.json({ limit: '1mb' }));

const clean = v => typeof v === 'string' ? v.trim() : v;
const newsArticleCache = new Map();
const googleNewsDecoder = new GoogleDecoder();

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
    'description'
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
  url.searchParams.set('pageSize', '5');
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

  return articles.slice(0, 5).map(article => {
    const source =
      article.source?.['#text'] ||
      article.source ||
      'Google News';

    const description = String(
      article.description || ''
    )
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

  const data = results.flatMap(
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
      `SELECT *
       FROM jobs
       WHERE company_id=$1
       ORDER BY created_at DESC`,
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
         (company_id,title,job_type,salary,stipend,apply_before,visit_date,visit_tag,status,status_class,batch,location,work_mode,description,category)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
          clean(b.category) || 'eligible'
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
             updated_at=NOW()
         WHERE id=$15 AND company_id=$16
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
          created_at,updated_at
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
          profile_completed=TRUE,
          updated_at=NOW()
         WHERE id=$24
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