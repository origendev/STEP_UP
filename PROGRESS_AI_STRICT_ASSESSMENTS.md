# STEP_UP Progress UI, AI preparation and strict assessments

## Files in this patch

Copy these files over the matching files in your existing project:

- `BACKEND/server.js`
- `FRONTEND/pages/progress.html`
- `FRONTEND/js/pages/progress.js`
- `FRONTEND/css/pages/progress.css`

This is a focused patch, not a full repository. It intentionally does not include `.env`, `.git`, dependencies, or student/company data.

## What it implements

### Student Progress UI
- Keeps the existing Progress route and application cards, with refined typography, spacing, contrast, status pills, progress indicators and responsive round cards.
- Reads the student's real applications and the rounds configured on each job.
- Displays per-round states, qualifying score, completed results, and a locked/unlocked state.
- Adds an AI preparation-plan panel for each round.

### AI assessment and scoring
- If `GEMINI_API_KEY` is configured in the backend environment, the backend asks Gemini to generate round-specific MCQs and preparation guidance.
- If AI generation is unavailable or returns invalid content, the assessment engine falls back to a small built-in practice question set. This fallback is not AI-generated and should be replaced with a reviewed question bank for production use.
- Answer keys remain on the server; the browser receives question text and options only.
- Scores are calculated server-side using saved answers.
- Assessment attempts, expiry, scores and integrity events are stored in PostgreSQL. The server's existing `ensureSchema()` creates the `assessment_attempts` table automatically on startup.
- An attempt is limited to one per application/round. The timer is enforced by the server expiry timestamp. Attempts expire and are submitted when the server receives a submit request after expiry.
- Later online assessment rounds require the previous online assessment to be submitted and passed. The default pass threshold is 60% unless the company configures `passingScore`/`passing_score`.

### Integrity checks
- Requests fullscreen when the assessment starts, when supported by the browser.
- Records tab-hidden, window-focus loss, fullscreen exit, copy/paste/cut/context-menu and selected keyboard-shortcut events.
- Blocks common copy/paste/context-menu actions in the assessment UI.
- Three recorded integrity events automatically submit the attempt.
- Adds a warning before leaving/reloading while an attempt is active.

**Security limitation:** browser-side anti-cheating controls are deterrents, not a guarantee. They cannot reliably detect a second device, all developer-tools use, remote assistance, or all operating-system/browser behaviours. For high-stakes exams, combine this with human proctoring, identity verification, question-bank rotation, server-side scheduling and audit review. Do not treat a browser event alone as proof of misconduct; review flags fairly.

## Deployment

1. Back up your working folder and copy the four files listed above to their matching paths.
2. Keep your existing `.env` file. Do not commit secrets.
3. Confirm the backend environment has `GEMINI_API_KEY` if you want AI-generated questions and preparation plans. The fallback still allows testing without it.
4. Restart/redeploy the backend first so `ensureSchema()` creates the assessment table, then redeploy the frontend.
5. Test using a student application whose status is `Selected`, `Shortlisted`, or `Interview` and a job with an online-test round configured.
6. Submit a test attempt and verify the result appears in Progress. Confirm a second attempt is rejected and a later test round remains locked until the previous test is passed.

## Validation performed

- `node --check BACKEND/server.js`
- `node --check FRONTEND/js/pages/progress.js`
- ZIP integrity check

The live PostgreSQL database, Gemini API credentials, deployed hosting environment, and full browser workflow were not available for end-to-end verification. Test on a staging copy before using this for real hiring decisions.
