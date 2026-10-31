# StepUp backend

Express + PostgreSQL API for the StepUp Company Portal and public Jobs page.

## What is now supported

- Company registration and login with JWT authentication.
- Companies can publish multiple jobs.
- Companies can edit and delete only their own listings.
- Public Jobs page reads from PostgreSQL, so changes are shared instead of being stored in a JS data file.
- Student profile edits—including Details and More content—and uploaded 10th/12th marksheets and Aadhaar proof are held for admin review; approved changes update the verified profile, and skill-course certificates are stored for admin review.
- Admins can add student skill courses with links, themes, and year/department targeting; matching students receive a notification, and new courses are highlighted for seven days. Admins can also hide or restore curated courses without deleting existing certificate reviews.
- Student documents, course certificates, profile proof images, and resumes can be up to 1 MB each. Supported images at or below the limit keep their original bytes and resolution; larger images use high-quality WebP/JPEG compression with a minimum resolution floor. PDFs are kept unchanged and must fit the limit.
- Public job detail page (`job-details.html?id=<job-id>`).
- Company profile information (industry/location/description) is included in public listings.
- Workspace Word/PDF conversions use LibreOffice on the backend to retain as much layout as the source format allows.
- Database tables are created/migrated automatically when the server starts.

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. Install LibreOffice Writer and its PDF import filter on the backend host for Workspace Word/PDF conversions. Install compatible fonts where possible; the deployment image includes Carlito (Calibri-compatible), Caladea (Cambria-compatible), Liberation, and DejaVu fonts. If `soffice` is not on `PATH`, set `LIBREOFFICE_PATH` in `BACKEND/.env` to its executable (for example, `C:\Program Files\LibreOffice\program\soffice.exe` on Windows).
4. `npm install`
5. `npm start`
6. Serve the `FRONTEND` folder with Live Server or `python -m http.server 5500`.

Workspace conversions run on the backend host; uploaded documents are processed in temporary directories and removed after conversion. Files are limited to 10 MB. DOCX-to-PDF uses LibreOffice's document renderer and preserves embedded images and document structure far better than text extraction. Page breaks or appearance can still differ from Microsoft Word when a document uses unavailable fonts or Word-specific features. PDF-to-DOCX imports the PDF into an editable document; because PDFs store fixed page positions rather than Word's original structure, exact visual and editing fidelity cannot be guaranteed, especially for scans and complex layouts.

## Render deployment with document conversion

The repository-root `Dockerfile` installs LibreOffice Writer, its PDF import filter, and fonts used by document conversion. To deploy it on Render, configure the backend web service to use the **Docker** runtime, keep the repository root as the build context, and use `Dockerfile` as the Dockerfile path. Keep the existing backend environment variables, including `DATABASE_URL` and `JWT_SECRET`; `LIBREOFFICE_PATH` is already set in the image.

An existing Render native-runtime service will not start using this Dockerfile just because it was added. If Render does not let you change that service to Docker, create a Docker web service for this repository, copy the existing environment variables, and update the frontend API URL if the replacement service gets a different URL. Verify the deployment logs show the image building and then test both conversion directions.

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
