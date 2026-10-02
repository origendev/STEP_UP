# StepUp backend

Express + PostgreSQL API for the StepUp Company Portal and public Jobs page.

## What is now supported

- Company registration and login with JWT authentication.
- Companies can publish multiple jobs.
- Companies can edit and delete only their own listings.
- Public Jobs page reads from PostgreSQL, so changes are shared instead of being stored in a JS data file.
- Public job detail page (`job-details.html?id=<job-id>`).
- Company profile information (industry/location/description) is included in public listings.
- Database tables are created/migrated automatically when the server starts.

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. `npm install`
4. `npm start`
5. Serve the `FRONTEND` folder with Live Server or `python -m http.server 5500`.

The frontend API address is kept in `FRONTEND/js/config.js`. Keep it as `http://localhost:3000/api` for local work.

## Team-wide / universal data sync

GitHub synchronizes the code, **not the database**. For all teammates to see the same company/job data, deploy this backend and PostgreSQL database once (for example on your team's cloud hosting), then put the deployed API URL in `FRONTEND/js/config.js` and push that file to GitHub.

Example:

```js
window.STEPUP_API_BASE_URL = 'https://YOUR-DEPLOYED-BACKEND/api';
```

Every teammate then pulls the same repository and uses the same API + PostgreSQL database. If a company adds/edits/deletes a job, every user sees the change after refreshing the Jobs page.

Never commit `.env`, database passwords, or JWT secrets to GitHub.
