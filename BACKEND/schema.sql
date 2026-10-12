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
  requirements TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'eligible',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  eligible_batches TEXT[] NOT NULL DEFAULT '{}',
  vacancies INTEGER NOT NULL DEFAULT 1,
  min_cgpa NUMERIC(4,2),
  backlogs_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  interview_rounds TEXT NOT NULL DEFAULT 'Not specified',
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  approval_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'IT';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
-- Backward-compatible migrations for older databases. Existing rows are retained.
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
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eligible_batches TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vacancies INTEGER NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS min_cgpa NUMERIC(4,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS backlogs_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_rounds TEXT NOT NULL DEFAULT 'Not specified';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Existing listings are grandfathered in as approved; all new submissions default to pending.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Approved';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE jobs ALTER COLUMN approval_status SET DEFAULT 'Pending';
CREATE INDEX IF NOT EXISTS idx_jobs_approval_status ON jobs(approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_before ON jobs(apply_before);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);

CREATE TABLE IF NOT EXISTS job_departments (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  UNIQUE(job_id, department)
);

CREATE INDEX IF NOT EXISTS idx_job_departments_job_id ON job_departments(job_id);

INSERT INTO job_departments (job_id, department)
SELECT j.id, d.department
FROM jobs j
CROSS JOIN (VALUES ('CSE'),('IT'),('EEE'),('ECE'),('Mechanical'),('Civil')) AS d(department)
WHERE NOT EXISTS (SELECT 1 FROM job_departments jd WHERE jd.job_id=j.id);

-- Student portal and OTP verification tables (additive integration).
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
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
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

CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

ALTER TABLE students ADD COLUMN IF NOT EXISTS study_year INTEGER NOT NULL DEFAULT 1;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_study_year_check;
ALTER TABLE students ADD CONSTRAINT students_study_year_check CHECK (study_year BETWEEN 1 AND 4);
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_student
  ON password_reset_otps(student_id, created_at DESC);


-- Applications submitted by students to specific jobs.
CREATE TABLE IF NOT EXISTS job_applications (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_student_id ON job_applications(student_id);

CREATE TABLE IF NOT EXISTS job_approval_history (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  approval_status TEXT NOT NULL CHECK (approval_status IN ('Pending','Approved','Rejected')),
  approval_note TEXT,
  changed_by_role TEXT NOT NULL,
  changed_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_approval_history_job ON job_approval_history(job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,
  changed_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_application_status_history_app ON application_status_history(application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('student','company','admin')),
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  application_id BIGINT REFERENCES job_applications(id) ON DELETE CASCADE,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, recipient_id, created_at DESC);

-- The exact PDF uploaded by the student.
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

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_rounds TEXT NOT NULL DEFAULT 'Not specified';

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_decision TEXT;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_feedback TEXT;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS company_verified_at TIMESTAMPTZ;
