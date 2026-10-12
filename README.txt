STEP_UP job publishing fix

Files included:
- BACKEND/server.js
- BACKEND/schema.sql

What changed:
1. Adds additive PostgreSQL migrations for job fields that may be missing in an older deployed database. CREATE TABLE IF NOT EXISTS alone does not update an existing table's columns.
2. Fixes the company job-edit SQL parameter positions (interview_rounds remains $16; job id/company id are $17/$18).
3. Adds structured backend logging for failed job publishing without exposing raw SQL/database errors to users.

Apply:
1. Back up your current repository and database before deploying.
2. Replace these files in the existing STEP_UP repository, preserving all other files and .env values.
3. Commit and push the changes. Render should redeploy the backend.
4. Test publishing a job. New jobs should still have approval_status = Pending and must be approved by Admin before students can see them.
5. If it still fails, open Render -> backend service -> Logs and look for "Failed to publish company job:". Share the message/code (remove secrets) for further diagnosis.
