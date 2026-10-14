# STEP_UP company rounds + verification patch

## Included
- Company job editor uses structured interview-round cards, not a raw JSON textarea.
- Each round has name, type, mode, duration, question count (online tests), cutoff, topics, and instructions.
- Role description and student requirements are separate fields and both persist to PostgreSQL.
- Company applicants page includes an Assessment verification panel for submitted tests.
- A recruiter must verify a submitted assessment as Pass before it unlocks the next round, regardless of the configured score cutoff.
- For interview, group discussion, and assignment rounds, the Applicants page provides Pass, Fail, and Needs review decisions. A company Pass unlocks the next round even when there is no numeric score.
- HR interview rounds support scheduled, in-portal one-on-one audio/video calls. The company starts the call from the applicant card; the student joins from Progress. Calls are peer-to-peer and are not recorded.
- Companies may add or edit rounds after assessments have started or company decisions have been recorded, provided decided rounds remain unchanged. New rounds appear on students' Progress pages as the page refreshes automatically.
- Question generation requests the configured question count from Gemini; fallback mode produces the configured number of items from the local bank (the local bank repeats if a larger count is requested).
- Existing jobs with JSON or legacy text round formats are parsed into editable fields.

## Apply
Deploy/restart the backend and frontend. Backend startup creates the HR interview session and short-lived signaling tables. For a database managed separately with startup migrations disabled, apply the matching schema.sql statements to the same PostgreSQL database first. Serve the student and company portals over HTTPS (localhost is supported for development) so browsers can grant camera and microphone access.

## Verification
1. Edit a job in Company Portal; add 2+ rounds and set question count on the online round.
2. Save/resubmit and reopen the job; verify the values persist and the role description remains unchanged.
3. As a selected student, submit round 1.
4. Company Portal -> Applicants -> Assessment verification: choose Pass or Fail and add feedback for an online assessment.
5. Confirm the next round unlocks on Pass even when the score is below the configured cutoff; Fail and Needs review keep it locked.
6. For a non-test round, record Pass in the applicant's Recruiter round decisions and confirm the next round unlocks.
7. After students have started a round, append another round without changing the attempted round and confirm the student Progress page reflects it within 15 seconds.
8. Configure an HR interview round, shortlist a student, schedule a future session from the applicant card, then start it at the scheduled time. Confirm the student sees the appointment in Progress and can join the live call; end the call from either portal and confirm both participants disconnect.

## Notes
Browser anti-cheating signals are deterrents, not proof of misconduct. Recruiters should review integrity events and apply consistent criteria. HR calls use direct peer-to-peer networking without an external STUN/TURN relay; networks that block direct WebRTC connectivity may not be able to connect.
