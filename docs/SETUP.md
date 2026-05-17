# RentauseD Setup

## Requirements
- Node.js 18+ (includes npm)

## Install
```bash
npm install
```

## Run
```bash
npm run start
```

Open http://localhost:3000 in your browser.

## Email (local SMTP)
This project is wired for Mailpit by default.

1) Start Mailpit (default SMTP port 1025).
2) Optionally override settings with env vars using a .env file (see .env.example):

```
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=no-reply@rentaused.local
SMTP_ENABLED=true
```

## Default Admin
- Email: admin@local
- Password: admin123

## Notes
- Uploaded images are stored in public/uploads.
- The SQLite database file is stored in data/rentaused.db.
- This is a local demo setup; secure secrets and session storage before production.
