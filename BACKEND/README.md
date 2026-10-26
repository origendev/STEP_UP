# StepUp backend

Express + PostgreSQL API for the StepUp Company Portal and public Jobs page.

## What is now supported

- Company registration and login with JWT authentication.
- Companies can publish multiple jobs.
- Companies can edit and delete only their own listings.
- Public Jobs page reads from PostgreSQL, so changes are shared instead of being stored in a JS data file.
- Public job detail page (`job-details.html?id=<job-id>`).
- Company profile information (industry/location/description) is included in public listings.
- Workspace Word/PDF conversions use LibreOffice on the backend to retain as much layout as the source format allows.
- Database tables are created/migrated automatically when the server starts.

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. `npm install`
4. `npm start`
5. Serve the `FRONTEND` folder with Live Server or `python -m http.server 5500`.

## Workspace document conversion

Install LibreOffice on the backend host and make its `soffice` executable available on `PATH`. If it is installed elsewhere or has a different executable name, set `LIBREOFFICE_PATH` in `BACKEND/.env` (for example, `C:\Program Files\LibreOffice\program\soffice.exe` on Windows). Restart the backend after installation or configuration.

Conversions are limited to files smaller than 10 MB. Word-to-PDF preserves the source document's formatting through LibreOffice. PDF-to-Word is inherently approximate because a PDF does not contain Word's document structure; complex layouts and scanned pages may need manual adjustment.

## AI demand outlook

The role outlook uses the Gemini Developer API free tier by default. Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GEMINI_API_KEY` in `BACKEND/.env`. Keep `DEMAND_AI_PROVIDER=gemini`; the default model is `gemini-3.8-flash`. If that model is temporarily busy, the backend retries with `gemini-2.5-flash`. No billing-enabled account is required to start on the free tier. Free-tier rate limits apply, and the app keeps its cited research baseline visible when the limit is reached.

OpenAI is disabled unless you explicitly set `DEMAND_AI_PROVIDER=openai` and configure `OPENAI_API_KEY`.

The frontend API address is kept in `FRONTEND/js/config.js`. Keep it as `http://localhost:3000/api` for local work.

## Team-wide / universal data sync

GitHub synchronizes the code, **not the database**. For all teammates to see the same company/job data, deploy this backend and PostgreSQL database once (for example on your team's cloud hosting), then put the deployed API URL in `FRONTEND/js/config.js` and push that file to GitHub.

Example:

```js
window.STEPUP_API_BASE_URL = 'https://YOUR-DEPLOYED-BACKEND/api';
```

Every teammate then pulls the same repository and uses the same API + PostgreSQL database. If a company adds/edits/deletes a job, every user sees the change after refreshing the Jobs page.

Never commit `.env`, database passwords, or JWT secrets to GitHub.
