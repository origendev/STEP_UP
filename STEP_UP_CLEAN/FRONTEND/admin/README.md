# StepUp Admin Console

This version includes the full admin management suite:

- Overview dashboard and KPIs
- Student add/edit/view/remove and resume access
- Company activation/suspension/removal
- Job monitoring, status updates and removal
- Application pipeline management
- Placement drive management
- Announcements
- Interview scheduling and status tracking
- Analytics
- CSV/Excel-compatible reports
- Admin activity log
- Additional admin accounts and roles

## Login
- Default Admin ID: `admin` unless `ADMIN_ID` is set in `BACKEND/.env`
- Password: the local `ADMIN_KEY` in `BACKEND/.env`
- Additional admin accounts can be created from Admin Roles.

## Run
1. Keep your existing `BACKEND/.env` file. Do not commit it.
2. From `BACKEND`, run `npm.cmd install` if `node_modules` is missing.
3. Start the API with `npm.cmd start`.
4. Run the `FRONTEND` folder with VS Code Live Server.
5. Open `/admin/admin-login.html`.

The ZIP intentionally does not contain `.env` or `node_modules`.
