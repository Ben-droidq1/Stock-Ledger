# Stock Ledger

A multi-shop inventory and sales workspace. The React app talks to an Express API backed by SQLite.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal. The API runs on port `3001`; Vite proxies `/api` requests to it. SQLite creates `data/shops.sqlite` on first start.

Set a unique `JWT_SECRET` in `.env` before deploying. Production startup refuses to run without it. `API_PORT` and `DATABASE_PATH` can also be configured there. The bundled development secret is only for local use.

To grant access to the separate platform-wide **Platform admin** page, set `PLATFORM_ADMIN_EMAILS` to a comma-separated list of administrator email addresses, for example `PLATFORM_ADMIN_EMAILS=admin@example.com`. Restart the API after changing the allowlist. The page shows account registration/last-login and shop membership metadata; it does not expose passwords or shop financials.

## Access model

- Sign up with an email and password, then create one or more shops. The creator becomes an owner of each shop and can switch between memberships from Account.
- Owners can manage inventory, sales, expenses, reports, and employee access.
- Employees can view inventory and record sales. They cannot access costs, profit figures, expenses, reports, or owner controls.
- Employee accounts start with an owner-issued temporary password and must change it at first sign-in.
- Login attempts are rate-limited, passwords use bcrypt, and API sessions use 15-minute JWTs.
- API data queries use the shop selected in the authenticated JWT and verify an active membership on every request; client-supplied shop IDs are never trusted as the data scope.

## Production notes

Use HTTPS, set a high-entropy `JWT_SECRET`, and configure a persistent writable SQLite path. For multiple API instances or high write volume, move the database and login rate-limit store to shared infrastructure. JWTs are held in browser local storage and expire after 15 minutes; users sign in again when a token expires.