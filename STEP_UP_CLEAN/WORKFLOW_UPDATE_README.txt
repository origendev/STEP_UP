STEP_UP JOB APPLICATION WORKFLOW UPDATE

Files in this patch (copy into the same paths in your existing STEP_UP repository):
- BACKEND/server.js
- FRONTEND/company/dashboard.html
- FRONTEND/company/applicants.html
- FRONTEND/js/pages/progress.js

Workflow implemented:
1. Company posts basic job details only. Interview rounds, role description and student requirements are removed from the job-post form.
2. New jobs are submitted as Pending for admin approval. Existing student notification logic continues to notify eligible students after approval.
3. Students apply to approved jobs. Applications appear in the company applicant page and in the student's Progress page.
4. Company reviews the student profile/resume and uses Shortlist, Waitlist or Reject. Shortlisted status is stored as `Shortlisted`; the student status notification routes to Progress.
5. After at least one applicant is shortlisted, the company can configure optional recruitment rounds from that job's Applicants page. Rounds are saved on that job and appear in Progress for applicants with a shortlisted/selected/interview status.
6. If no interview is required, leave the rounds list empty. Progress shows that no rounds have been configured instead of showing a test.
7. Existing secure assessment and company round-verification workflow remains in place for online test rounds.

Apply carefully:
- Back up your working tree first.
- Copy only the four files above; do not replace your whole repository.
- Keep `.env`, credentials, `.git`, and database data untouched. No secrets are included in this patch.
- Run `node --check BACKEND/server.js` and `node --check FRONTEND/js/pages/progress.js`.
- Test in local/development first: create job -> admin approves -> student receives job notification -> student applies -> company shortlists -> company adds rounds (if needed) -> student's Progress shows the correct status and rounds.
- The frontend is static HTML/JS; backend API runs from BACKEND/server.js. Deploy the frontend and backend changes to their respective services.
