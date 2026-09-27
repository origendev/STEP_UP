import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map(s=>s.trim()) : true }));
app.use(express.json({limit:'1mb'}));
const clean = v => typeof v === 'string' ? v.trim() : v;

async function ensureSchema(){
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
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'IT';
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_apply_before ON jobs(apply_before);
    CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
  `);
}

function issueToken(company) { return jwt.sign({companyId:company.id,email:company.email},JWT_SECRET,{expiresIn:'8h'}); }
function requireCompany(req,res,next){
  const h=req.get('authorization')||'', token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token) return res.status(401).json({error:'Authentication required.'});
  try { req.company=jwt.verify(token,JWT_SECRET); next(); }
  catch { return res.status(401).json({error:'Session expired. Please sign in again.'}); }
}
function validateJob(b){
  for(const k of ['title','jobType','applyBefore','description']) if(!clean(b[k])) return `${k} is required.`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.applyBefore)) return 'Apply-before date must be YYYY-MM-DD.';
  if(b.visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(b.visitDate)) return 'Visit date must be YYYY-MM-DD.';
  return null;
}

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:'postgresql'});}catch{res.status(503).json({ok:false,error:'Database unavailable.'});}});

app.post('/api/auth/register',async(req,res)=>{
  const name=clean(req.body.companyName), email=clean(req.body.email)?.toLowerCase(), password=req.body.password;
  const website=clean(req.body.website)||null, industry=clean(req.body.industry)||'IT', location=clean(req.body.location)||null, description=clean(req.body.description)||null;
  if(!name||!email||!password) return res.status(400).json({error:'Company name, work email and password are required.'});
  if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
  try{
    const hash=await bcrypt.hash(password,12);
    const r=await pool.query(`INSERT INTO companies(name,email,password_hash,website,industry,location,description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,website,industry,location,description,created_at`,[name,email,hash,website,industry,location,description]);
    const company=r.rows[0]; res.status(201).json({data:{company,token:issueToken(company)}});
  }catch(e){if(e.code==='23505')return res.status(409).json({error:'A company account already exists for that email.'});console.error(e);res.status(500).json({error:'Could not create the company account.'});}
});

app.post('/api/auth/login',async(req,res)=>{
  const email=clean(req.body.email)?.toLowerCase(),password=req.body.password;
  if(!email||!password)return res.status(400).json({error:'Work email and password are required.'});
  try{
    const r=await pool.query(`SELECT id,name,email,password_hash,website,industry,location,description,created_at FROM companies WHERE email=$1`,[email]);
    const company=r.rows[0];
    if(!company||!(await bcrypt.compare(password,company.password_hash)))return res.status(401).json({error:'Invalid work email or password.'});
    delete company.password_hash;res.json({data:{company,token:issueToken(company)}});
  }catch(e){console.error(e);res.status(500).json({error:'Could not sign in.'});}
});

app.get('/api/company/me',requireCompany,async(req,res)=>{
  const r=await pool.query(`SELECT id,name,email,website,industry,location,description,created_at FROM companies WHERE id=$1`,[req.company.companyId]);
  if(!r.rows[0])return res.status(404).json({error:'Company account not found.'});res.json({data:r.rows[0]});
});

app.patch('/api/company/me',requireCompany,async(req,res)=>{
  const b=req.body;
  if(!clean(b.name))return res.status(400).json({error:'Company name is required.'});
  try{
    const r=await pool.query(`UPDATE companies SET name=$1,website=$2,industry=$3,location=$4,description=$5,updated_at=NOW() WHERE id=$6 RETURNING id,name,email,website,industry,location,description,created_at`,[clean(b.name),clean(b.website)||null,clean(b.industry)||'IT',clean(b.location)||null,clean(b.description)||null,req.company.companyId]);
    res.json({data:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not update company profile.'});}
});

app.get('/api/company/jobs',requireCompany,async(req,res)=>{
  const r=await pool.query(`SELECT * FROM jobs WHERE company_id=$1 ORDER BY created_at DESC`,[req.company.companyId]);res.json({data:r.rows});
});

app.post('/api/company/jobs',requireCompany,async(req,res)=>{
  const b=req.body,err=validateJob(b);if(err)return res.status(400).json({error:err});
  try{
    const r=await pool.query(`INSERT INTO jobs(company_id,title,job_type,salary,stipend,apply_before,visit_date,visit_tag,status,status_class,batch,location,work_mode,description,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,[req.company.companyId,clean(b.title),clean(b.jobType),clean(b.salary)||null,clean(b.stipend)||null,b.applyBefore,clean(b.visitDate)||null,clean(b.visitTag)||null,clean(b.status)||'Eligible',clean(b.statusClass)||'status-amber',clean(b.batch)||null,clean(b.location)||null,clean(b.workMode)||null,clean(b.description),clean(b.category)||'eligible']);
    res.status(201).json({data:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not publish the job.'});}
});

app.patch('/api/company/jobs/:id',requireCompany,async(req,res)=>{
  const b=req.body,err=validateJob(b);if(err)return res.status(400).json({error:err});
  try{
    const r=await pool.query(`UPDATE jobs SET title=$1,job_type=$2,salary=$3,stipend=$4,apply_before=$5,visit_date=$6,visit_tag=$7,status=$8,status_class=$9,batch=$10,location=$11,work_mode=$12,description=$13,category=$14,updated_at=NOW() WHERE id=$15 AND company_id=$16 RETURNING *`,[clean(b.title),clean(b.jobType),clean(b.salary)||null,clean(b.stipend)||null,b.applyBefore,clean(b.visitDate)||null,clean(b.visitTag)||null,clean(b.status)||'Eligible',clean(b.statusClass)||'status-amber',clean(b.batch)||null,clean(b.location)||null,clean(b.workMode)||null,clean(b.description),clean(b.category)||'eligible',req.params.id,req.company.companyId]);
    if(!r.rows[0])return res.status(404).json({error:'Job not found or you do not own this listing.'});res.json({data:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not update the job.'});}
});

app.delete('/api/company/jobs/:id',requireCompany,async(req,res)=>{
  const r=await pool.query(`DELETE FROM jobs WHERE id=$1 AND company_id=$2 RETURNING id`,[req.params.id,req.company.companyId]);
  if(!r.rows[0])return res.status(404).json({error:'Job not found or you do not own this listing.'});res.status(204).end();
});

const publicJobSelect=`SELECT j.id,j.company_id,c.name AS company_name,c.industry,c.location AS company_location,c.description AS company_description,c.website,j.title,j.job_type,j.salary,j.stipend,j.apply_before,j.visit_date,j.visit_tag,j.status,j.status_class,j.batch,j.location,j.work_mode,j.description,j.category,j.created_at,j.updated_at FROM jobs j JOIN companies c ON c.id=j.company_id`;
app.get('/api/jobs',async(_req,res)=>{try{const r=await pool.query(`${publicJobSelect} ORDER BY j.created_at DESC`);res.json({data:r.rows});}catch(e){console.error(e);res.status(500).json({error:'Could not load jobs.'});}});
app.get('/api/jobs/:id',async(req,res)=>{try{const r=await pool.query(`${publicJobSelect} WHERE j.id=$1`,[req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Job listing not found.'});res.json({data:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Could not load the job listing.'});}});

ensureSchema().then(()=>app.listen(PORT,()=>console.log(`StepUp API running on http://localhost:${PORT}`))).catch(err=>{console.error('Database/schema setup failed:',err);process.exit(1);});
