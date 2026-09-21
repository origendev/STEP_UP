CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_before ON jobs(apply_before);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
