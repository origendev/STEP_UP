STEP_UP assessment verification loading + progress gate fix

Copy the included files into the matching paths in your existing STEP_UP repository. Preserve .env and .git.

Fixes:
1. Company applicants page now calls loadAssessmentReviews() after the job/applicant context loads. This was missing, so the UI remained on “Loading submitted assessments…” forever.
2. Student applications API now returns company_verified and company_decision for assessment attempts.
3. Progress completion now counts only company-verified Pass rounds; submitted but unverified attempts show “Awaiting company verification” and do not unlock later rounds.

After copying: restart/redeploy the backend and redeploy frontend files. Test with a new/submitted aptitude attempt, open Company Portal > Applicants for the same job, and verify Pass/Fail. A score alone does not count as a passed round until company verification.
