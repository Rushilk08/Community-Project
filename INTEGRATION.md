# WorkSetu — Frontend Infrastructure & Team Integration Guide (Member 4)

Welcome to the **WorkSetu** frontend infrastructure. This document outlines the shared architecture, directory structure, authentication workflows, centralized API client, multilingual system, and polling hooks created by **Member 4** for seamless integration with **Member 1 (Backend)**, **Member 2 (Customer Pages)**, and **Member 3 (Worker Pages)**.

---

## 1. Directory Structure

```text
frontend/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── src/
│   ├── main.jsx                  # Entry point with i18n and global CSS
│   ├── App.jsx                   # Centralized routing & Role-based protected routes
│   │
│   ├── services/
│   │   ├── supabase.js           # Supabase client & environment configuration
│   │   └── api.js                # Centralized Flask API client with token injection & mock adapter
│   │
│   ├── context/
│   │   └── AuthContext.jsx       # Supabase Auth, session persistence, role management
│   │
│   ├── routes/
│   │   ├── ProtectedRoute.jsx    # Role guard (customer vs worker) & unauth redirect
│   │   └── RoleRedirect.jsx     # Redirects authenticated users to their respective dashboard
│   │
│   ├── components/
│   │   ├── Navbar.jsx            # Shared role-aware navbar, logo, language selector & logout
│   │   ├── LanguageSwitcher.jsx  # English, Kannada, Hindi selector (reactive, localStorage backed)
│   │   ├── Loading.jsx           # Accessible loading indicator
│   │   └── ErrorMessage.jsx      # Standardized alert & error banner with retry
│   │
│   ├── hooks/
│   │   ├── useWorkerOffers.js    # ~3-second real-time polling hook for nearby job offers
│   │   └── useJobStatus.js       # ~3-second real-time polling hook for customer hiring status
│   │
│   ├── i18n/
│   │   ├── i18n.js               # i18next configuration
│   │   └── locales/
│   │       ├── en.json           # English translations
│   │       ├── kn.json           # Kannada translations (ಕನ್ನಡ)
│   │       └── hi.json           # Hindi translations (हिन्दी)
│   │
│   ├── pages/
│   │   ├── Home.jsx              # Landing page
│   │   ├── Login.jsx             # Public login
│   │   ├── Register.jsx          # Role-based registration (customer / worker)
│   │   ├── customer/             # Member 2's workspace (Clean placeholders provided)
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── PostJob.jsx
│   │   │   ├── LiveHiring.jsx
│   │   │   ├── ConfirmedWorkers.jsx
│   │   │   └── MyJobs.jsx
│   │   └── worker/               # Member 3's workspace (Clean placeholders provided)
│   │       ├── Dashboard.jsx
│   │       ├── Profile.jsx
│   │       ├── JobOffers.jsx
│   │       ├── AcceptedJob.jsx
│   │       ├── MyJobs.jsx
│   │       └── Groups.jsx
│   │
│   └── styles/
│       └── global.css            # Mobile-first labour marketplace design system
```

---

## 2. Environment Configuration (`.env`)

Create a `.env` file in `frontend/` by copying `.env.example`:

```bash
cp frontend/.env.example frontend/.env
```

Set the values:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Flask Backend API URL (Member 1)
VITE_API_URL=http://localhost:5000/api

# Local Mock Adapter (Optional: set to 'true' to simulate backend offline)
VITE_ENABLE_MOCKS=false
```

> **Security Note:** Never commit `.env` or service role keys to Git. Only the public `VITE_SUPABASE_ANON_KEY` is used in frontend client.

---

## 3. Authentication & Role Management (`AuthContext.jsx`)

Members 2 and 3 can access user state and authentication functions anywhere in the component tree via the `useAuth()` hook:

```jsx
import { useAuth } from '../../context/AuthContext';

function MyComponent() {
  const { user, role, isAuthenticated, loading, signOut } = useAuth();

  // user: Supabase User object
  // role: 'customer' | 'worker'
}
```

### Supported Roles & Route Protection
- **`customer`**: Accesses `/customer/*` routes.
- **`worker`**: Accesses `/worker/*` routes.
- **Unauthenticated**: Redirected to `/login` with previous location preserved in `state.from`.
- **Unauthorized**: If a worker visits `/customer/dashboard`, they are automatically redirected to `/worker/dashboard`.

---

## 4. Centralized Flask API Client (`api.js`)

All requests to Member 1's Flask API must go through `src/services/api.js`. The client automatically:
1. Attaches `Authorization: Bearer <Supabase_JWT_Token>`.
2. Encodes JSON bodies.
3. Sets timeout and cancellation signals.
4. Throws structured errors with `status` and `data`.
5. Includes a graceful mock fallback adapter for development before Member 1's backend goes live.

### Available API Functions:

```javascript
import {
  createJob,
  getMyJobs,
  getJobStatus,
  updateWorkerAvailability,
  updateWorkerLocation,
  getWorkerOffers,
  acceptOffer,
  rejectOffer,
  getWorkerBookings,
  getBookingDetails,
  createWorkerGroup
} from '../../services/api';
```

### Member 1 Backend Contract Confirmation:

| Function | Method | Expected Flask Endpoint | Request Body |
|---|---|---|---|
| `createJob(data)` | `POST` | `/jobs` | `{ title, description, skill, wage, workers_required, location, date }` |
| `getMyJobs()` | `GET` | `/jobs/my-jobs` | None |
| `getJobStatus(jobId)` | `GET` | `/jobs/<job_id>/status` | None |
| `updateWorkerAvailability(bool)` | `PATCH` | `/workers/availability` | `{ is_available: true/false }` |
| `updateWorkerLocation(coords)` | `PATCH` | `/workers/location` | `{ lat, lng }` |
| `getWorkerOffers()` | `GET` | `/workers/offers` | None |
| `acceptOffer(offerId)` | `POST` | `/workers/offers/<offer_id>/accept` | None |
| `rejectOffer(offerId, reason)` | `POST` | `/workers/offers/<offer_id>/reject` | `{ reason }` |
| `getWorkerBookings()` | `GET` | `/workers/bookings` | None |
| `getBookingDetails(id)` | `GET` | `/bookings/<booking_id>` | None |
| `createWorkerGroup(data)` | `POST` | `/workers/groups` | `{ group_name, members_count, skills }` |

---

## 5. Multilingual System (English, Kannada, Hindi)

WorkSetu provides out-of-the-box multilingual support:
- **English (`en`)**
- **Kannada (`kn`)** (ಕನ್ನಡ)
- **Hindi (`hi`)** (हिन्दी)

### How Members 2 and 3 should use translations:

```jsx
import { useTranslation } from 'react-i18next';

export default function MyPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('dashboard')}</h1>
      <button>{t('postJob')}</button>
      <span>{t('wage')}: ₹800</span>
    </div>
  );
}
```

### Key Translation Keys:
`welcome`, `login`, `register`, `dashboard`, `profile`, `postJob`, `findWork`, `myJobs`, `available`, `unavailable`, `accept`, `reject`, `jobDescription`, `location`, `wage`, `workersRequired`, `confirmedWorkers`, `pendingRequests`, `logout`, `selectLanguage`, `loading`, `error`, `save`, `cancel`, `navigate`, `role`, `customer`, `worker`.

---

## 6. Real-time Polling Hooks

### A. For Member 3 (Worker Job Offers) — `useWorkerOffers.js`
Polls Flask backend every 3 seconds while active, prevents duplicates, and cleans up on unmount.

```jsx
import useWorkerOffers from '../../hooks/useWorkerOffers';

function WorkerDashboard() {
  const { offers, loading, error, isPolling, refresh, removeOffer } = useWorkerOffers({
    pollingIntervalMs: 3000,
    enabled: true
  });

  return (
    <div>
      {loading && <p>Loading offers...</p>}
      {offers.map(offer => (
        <div key={offer.id}>
          <h4>{offer.title} - ₹{offer.wage}</h4>
          <button onClick={() => acceptOffer(offer.id)}>Accept</button>
        </div>
      ))}
    </div>
  );
}
```

### B. For Member 2 (Customer Live Hiring) — `useJobStatus.js`
Polls job hiring status every 3 seconds for accepted worker counts and open vacancies.

```jsx
import useJobStatus from '../../hooks/useJobStatus';

function LiveHiringPage({ jobId }) {
  const { jobStatus, loading, error, isPolling, refresh } = useJobStatus(jobId, {
    pollingIntervalMs: 3000
  });

  return (
    <div>
      <h3>Confirmed: {jobStatus?.confirmed_workers} / {jobStatus?.workers_required}</h3>
      <h3>Pending: {jobStatus?.pending_requests}</h3>
    </div>
  );
}
```

---

## 7. How to Run & Build

From repository root:

```bash
# 1. Navigate to frontend
cd frontend

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```
