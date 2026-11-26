# CardinalPool — Mapúa University Intramuros Carpooling Web App

A full-stack campus carpooling platform built specifically for **Mapúa University** students and faculty commuting to the single fixed destination of **[Mapúa University Intramuros](https://mapua.edu.ph/location/intramuros/) (658 Muralla St, Intramuros, Manila)**.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, [Leaflet](https://leafletjs.com/) + `react-leaflet`, `socket.io-client`
- **Backend:** Node.js 18+, Express, TypeScript, Zod, JWT, `bcryptjs`, Nodemailer, Socket.IO
- **Database:** PostgreSQL 16 (ACID transactions, `SELECT ... FOR UPDATE` token escrow, DB-level 24-hour booking trigger)
- **Routing & ETA:** OpenStreetMap tiles + OSRM driving route API with Metro Manila Haversine urban-speed fallback

## Core Features Implemented

1. **Mapúa-Only Institutional Authentication & Role Switching**
   - Restricts registration strictly to `@mymail.mapua.edu.ph` (Students — per [Mapúa Support](https://support.mapua.edu.ph/kb/article/4/account-password-registration)) and `@mapua.edu.ph` (Faculty/Employees — per [Mapúa IT Helpdesk](https://www.mapua.edu.ph/services/it-helpdesk/)).
   - Enforces institutional email verification via signed token before sign-in is allowed.
   - Allows users to register as a Rider or Driver, store their Mapúa department, ID number, and vehicle information, and toggle between **Rider** and **Driver** modes at any time.

2. **Cashless Token Economy & Wallet Dashboard**
   - New verified users receive **100 Cardinal Tokens** (`WELCOME_BONUS`).
   - Booking a seat atomically debits the rider's tokens into escrow (`BOOKING_ESCROW`) inside a PostgreSQL transaction with row-level locking.
   - Completing a trip at Mapúa Intramuros (`POST /api/trips/:id/complete`) automatically releases all escrowed rider tokens to the driver (`TRIP_PAYOUT`).
   - Cancelling a booking (≥ 24 hours before departure) or cancelling a trip automatically issues a `BOOKING_REFUND`.
   - Includes a dedicated **Token Wallet Dashboard** displaying available balance, escrowed tokens, earned/spent totals, and filterable ledger history.

3. **Strict 24-Hour Advance Pre-Booking System**
   - All trips terminate at the fixed destination **Mapúa University Intramuros (`14.5902, 120.9787`)** — enforced in both backend constants and PostgreSQL `CHECK` constraints.
   - Drivers add custom **along-the-way pick-up points** by clicking directly on the Leaflet map when creating a trip.
   - Backend API (`bookingRules.ts`) **and** a PostgreSQL `BEFORE INSERT` trigger (`enforce_24h_advance_booking`) reject any booking attempt less than **24 hours** before scheduled departure (`400 BOOKING_WINDOW_CLOSED`).

4. **Interactive Real-Time Map & Dynamic ETA**
   - Displays the full driving route to Mapúa Intramuros, numbered along-the-way pick-up markers, and live GPS positions of the driver and booked riders via Socket.IO (`trip:join`, `location:update`, `location:broadcast`).
   - Dynamically recalculates and broadcasts (`eta:update`) both the driver's ETA to each rider's selected pick-up point and the carpool's ETA to Mapúa University Intramuros.
   - Includes a **Simulate Route** button on the Live Map so you can test live GPS movement and ETA updates locally from a single browser.

---

## Project Structure

```text
cardinalpool/
├── docker-compose.yml            # PostgreSQL 16 + MailHog local SMTP UI
├── database/
│   ├── schema.sql                # Tables, constraints, indexes, and 24-hour booking trigger
│   └── seed.sql                  # Demo Mapúa users, upcoming trips, pick-up stops, and wallet tx
├── backend/
│   ├── .env.example
│   ├── src/
│   │   ├── config/               # Constants, env loader, PostgreSQL pool & ACID tx helper
│   │   ├── middleware/           # JWT auth, email verification guard, error handler
│   │   ├── services/             # Email validator/mailer, 24h booking rule, OSRM ETA, token ledger
│   │   ├── routes/               # /auth, /users, /trips, /bookings, /wallet
│   │   ├── sockets/              # Socket.IO live GPS & dynamic ETA broadcasting
│   │   ├── app.ts
│   │   └── server.ts
│   └── tests/coreLogic.test.mjs  # Automated Node.js test suite
└── frontend/
    ├── .env.example
    └── src/
        ├── context/AuthContext.tsx
        ├── services/             # API client & Socket.IO wrapper
        ├── components/           # Navbar, AuthView, TripCard, CreateTripModal, LiveTripMap, WalletDashboard, ProfileSettings
        └── App.tsx
```

---

## Local Setup & Running Instructions

### Prerequisites
- **Node.js 18+** and **npm**
- **Docker Desktop** (recommended for one-command PostgreSQL + MailHog), or a local **PostgreSQL 15+** installation

### 1. Start PostgreSQL (and MailHog) via Docker Compose
From the project root (`cardinalpool/`):
```bash
docker compose up -d
```
This automatically creates the `cardinalpool` database, runs `database/schema.sql`, and loads `database/seed.sql`.
- MailHog web UI (to inspect verification emails locally): `http://localhost:8025`

*(Alternative without Docker)*: Create a PostgreSQL database named `cardinalpool` and run:
```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```

### 2. Configure & Start the Backend
```bash
cd backend
cp .env.example .env
# Edit .env if your PostgreSQL credentials or JWT_SECRET differ
npm install
npm test      # Runs unit tests for Mapúa email validation, 24h booking rule, and ETA math
npm run dev   # Starts API + Socket.IO server on http://localhost:4000
```

### 3. Configure & Start the Frontend
In a second terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev   # Starts Vite React app on http://localhost:5173
```

### 4. Demo Accounts (from `database/seed.sql`)
- **Faculty Driver:** `engr.santos@mapua.edu.ph`
- **Student Rider:** `jdelacruz@mymail.mapua.edu.ph`
- **Student Driver:** `mreyes@mymail.mapua.edu.ph`
- Or register any new `@mymail.mapua.edu.ph` / `@mapua.edu.ph` email — in development mode, the registration response also displays a one-click dev verification link right in the UI.

---

## Key Backend API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register Mapúa student/faculty, grant 100 tokens, send verification email |
| `GET` | `/api/auth/verify-email?token=...` | Verify institutional email token |
| `POST` | `/api/auth/login` | Authenticate verified user and return JWT |
| `PATCH` | `/api/users/mode` | Switch active mode between `RIDER` and `DRIVER` |
| `PATCH` | `/api/users/profile` | Update department and driver vehicle details |
| `POST` | `/api/trips` | Driver posts trip to Mapúa Intramuros with custom pick-up points |
| `GET` | `/api/trips` | List upcoming/active trips with 24-hour booking eligibility flags |
| `GET` | `/api/trips/:id` | Get trip route, stops, booked riders, live GPS pins, and dynamic ETA |
| `POST` | `/api/trips/:id/start` | Start trip for live GPS tracking |
| `POST` | `/api/trips/:id/complete` | Complete trip and automatically transfer escrowed tokens to driver |
| `POST` | `/api/bookings` | Pre-book a seat (enforces strict 24-hour rule + atomic token escrow) |
| `POST` | `/api/bookings/:id/cancel` | Cancel booking (≥ 24h prior) and refund escrowed tokens |
| `GET` | `/api/wallet` | View Cardinal Token balance, escrow total, and full transaction ledger |
