# StepUp frontend

## Run

Serve this folder with VS Code Live Server or:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

Do not open `index.html` directly because the app router loads page partials with `fetch()`.

## Company → Jobs flow

1. Open **Company Portal** from Jobs.
2. A company creates/signs into its account.
3. The company publishes a job.
4. The public Jobs page reads that job from the backend database.
5. **View Details** opens the full listing.
6. The company can edit or delete its own listing from the Company Portal.
7. After refresh, all users connected to the same backend/database see the same listing.

## Shared data for the whole team

`js/config.js` contains the backend address:

```js
window.STEPUP_API_BASE_URL = 'http://localhost:3000/api';
```

For universal team sync, deploy the backend + one PostgreSQL database and replace that value with the deployed API URL. Commit the config change to GitHub. Every teammate then uses the same database rather than separate browser/local data.

Saved companies are intentionally user/browser-specific and are stored in localStorage; company/job listings are shared through PostgreSQL.
