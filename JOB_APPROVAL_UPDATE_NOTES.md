# STEP_UP job approval update

## What changed
- Every company job is reviewed as an individual listing. A company's previously approved jobs do not automatically approve new roles.
- New submissions start as `Pending`; editing an existing role sends it back to `Pending` review.
- Admin > Jobs now has a dedicated approval workspace with status tabs, search, summary counts, role details, approve actions, and rejection feedback.
- Rejection requires a reason, which is saved and shown to the company.
- Only approved jobs from active companies are returned to the student jobs list, job-detail API, apply API, and student notification feed.
- Student job notifications are generated from each approved job and filtered by the student's department and year eligibility.
- Existing jobs are grandfathered as approved when the approval column is first added; new submissions use pending by default.

## Deployment
1. Commit and push the changed files to GitHub.
2. Redeploy/restart the backend first. `ensureSchema()` adds the approval columns automatically.
3. Redeploy the frontend.
4. Test with a company account: submit a second role, confirm it shows Pending in Company and Admin, approve it in Admin > Jobs, then confirm it appears to eligible students and their notification bell.
5. Test rejection and verify the company sees the saved rejection reason. Editing the role should send it back to Pending.

## Important behavior
Students only see jobs for their selected department and from active companies, and the existing rule that jobs unlock for third-year and fourth-year students is preserved.
