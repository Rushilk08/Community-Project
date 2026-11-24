# WorkLink

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)](frontend/)
[![Backend: Flask](https://img.shields.io/badge/Backend-Flask-000000?logo=flask&logoColor=white)](backend/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**WorkLink** is a location-aware daily-wage and short-term work platform that connects customers with available local workers. It provides separate experiences for customers and workers, real-time hiring progress, skill and location-based matching, offer dispatch, worker groups, and safety reporting.

Designed for local work markets, WorkLink supports **English, Kannada, and Hindi** and is suitable for construction, maintenance, cleaning, painting, carpentry, electrical work, and general labour.

---

## Why WorkLink

Daily-wage workers often struggle to find consistent short-term opportunities, while customers spend valuable time searching for reliable people for urgent work.

WorkLink addresses this gap with:

- Role-based customer and worker accounts
- Skill, wage, location, and availability matching
- Live job and worker hiring status
- Short-lived offers sent to nearby eligible workers
- One-worker-per-job booking safeguards
- Multilingual interfaces
- Worker profiles, groups, reports, and audit records
- Built-in demo fallbacks for frontend testing

---

## Features

### For customers

- Create and manage short-term job postings
- Specify required skill, daily wage, worker count, date, and worksite
- Dispatch offers to nearby available workers
- Track accepted and pending workers in real time
- View worker contact and experience details
- Cancel active jobs

### For workers

- Create a worker profile and set trade skills
- Update availability and location
- Receive nearby job offers
- Accept or reject offers
- View confirmed and completed bookings
- Create and manage worker groups

### Platform safeguards

- Supabase authentication and Row Level Security
- Protected customer and worker routes
- Coordinate validation
- Minimum wage floor checks
- Prohibited-work and safety keyword filtering
- Offer expiry and stale-location handling
- Audit logging and reporting

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, i18next |
| Backend | Python 3, Flask, Flask-CORS |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Testing | Pytest |
| Hosting-ready | REST API + SPA architecture |

---

## Project Structure

```text
Community-Project/
├── backend/
│   ├── app.py                  # Flask application and API registration
│   ├── config.py               # Environment configuration
│   ├── requirements.txt        # Python dependencies
│   ├── routes/                 # Customer, worker, job, booking, and report APIs
│   ├── services/               # Auth, matching, dispatch, and validation logic
│   ├── database/               # Supabase client and production schema
│   └── tests/                  # Backend and validation tests
├── frontend/
│   ├── src/
│   │   ├── pages/              # Public, customer, and worker screens
│   │   ├── components/         # Reusable interface components
│   │   ├── services/           # API and Supabase integrations
│   │   ├── context/            # Authentication state
│   │   ├── hooks/              # Polling and offer hooks
│   │   └── i18n/               # English, Kannada, and Hindi translations
│   ├── package.json
│   └── vite.config.js
├── supabase_schema.sql         # Alternate Supabase setup script
└── LICENSE
```

---

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- npm
- A Supabase project

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Rushilk08/Community-Project.git
cd Community-Project
```

### 2. Configure Supabase

Create a project in the Supabase dashboard, then run the SQL setup script:

1. Open **SQL Editor**
2. Create a new query
3. Paste the contents of [`backend/database/schema.sql`](backend/database/schema.sql)
4. Run the query

Supabase Auth is used for authentication, and the profiles table is synchronized from authenticated user metadata.

### 3. Configure the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

- **Windows PowerShell**

  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```

- **macOS/Linux**

  ```bash
  source .venv/bin/activate
  ```

Install dependencies and create the environment file:

```bash
pip install -r requirements.txt
copy .env.example .env
```

On macOS/Linux, replace `copy` with `cp`.

Update `backend/.env`:

```dotenv
PORT=5000
FLASK_ENV=development
SECRET_KEY=replace-with-a-random-secret

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

DISPATCH_RADIUS_KM=10
OFFER_EXPIRY_MINUTES=5
LOCATION_STALE_HOURS=24
```

> Never expose the Supabase service-role key in frontend code or commit it to source control.

Start the API:

```bash
python app.py
```

The API will be available at `http://localhost:5000`.

### 4. Configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Update `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_MOCKS=false
```

Open `http://localhost:5173`.

---

## Demo Mode

The frontend includes a mock-response adapter and can continue basic flows when the backend is offline or `VITE_ENABLE_MOCKS=true`. Demo mode is intended for UI testing and demonstrations, not production use.

For fully integrated use:

1. Configure Supabase
2. Run the database schema
3. Start the Flask backend
4. Set valid frontend Supabase credentials
5. Set `VITE_ENABLE_MOCKS=false`

---

## API Overview

Base URL:

```text
http://localhost:5000/api
```

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API and Supabase status |
| `POST` | `/jobs` | Create a job |
| `GET` | `/jobs/my-jobs` | Get the customer's jobs |
| `GET` | `/jobs/:jobId/status` | Poll live hiring progress |
| `POST` | `/jobs/:jobId/cancel` | Cancel a job |
| `PATCH` | `/workers/availability` | Update worker availability |
| `PATCH` | `/workers/location` | Update worker coordinates |
| `GET` | `/workers/offers` | Get pending worker offers |
| `POST` | `/workers/offers/:offerId/accept` | Accept an offer |
| `POST` | `/workers/offers/:offerId/reject` | Reject an offer |
| `GET` | `/workers/bookings` | Get worker bookings |
| `GET` | `/bookings/:bookingId` | Get booking details |

Most mutation and retrieval routes require a valid Supabase bearer token. The backend uses role checks to separate customer and worker operations.

---

## Running Tests

Run the backend test suite from the project root:

```bash
cd backend
pytest
```

Build the frontend to verify the production bundle:

```bash
cd frontend
npm run build
```

---

## Environment Reference

### Backend

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Flask server port | `5000` |
| `FLASK_ENV` | Runtime mode | `development` |
| `SECRET_KEY` | Application secret | Development placeholder |
| `SUPABASE_URL` | Supabase project URL | — |
| `SUPABASE_ANON_KEY` | Supabase public key | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase privileged key | — |
| `DISPATCH_RADIUS_KM` | Worker matching radius | `10` |
| `OFFER_EXPIRY_MINUTES` | Pending offer lifetime | `5` |
| `LOCATION_STALE_HOURS` | Maximum worker-location age | `24` |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public/anonymous key |
| `VITE_API_URL` | Flask API base URL |
| `VITE_ENABLE_MOCKS` | Enable local API mock fallback |

---

## Security

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Use production secrets and environment-specific configuration
- Do not commit real `.env` values
- Enforce and review Supabase RLS policies
- Add HTTPS and stricter CORS rules before public deployment
- Review wage, safety, eligibility, and dispute workflows for local legal requirements

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Make focused, tested changes
4. Open a pull request with a clear description and verification steps

Please avoid committing credentials, generated build output, or environment-specific configuration.

---

## License

WorkLink is released under the [MIT License](LICENSE).
