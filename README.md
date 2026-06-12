# SplitWise Clone

A modern, production-ready Splitwise clone designed to track shared bills, handle diverse splitting strategies, outline optimal settlement paths, and support real-time chat discussions. 

Built with **React (Vite + Tailwind CSS)** and **Django (REST Framework + Channels)**, backed by **PostgreSQL**.

---

## Features
- **Secure JWT Authentication:** Registration, login, token refresh, and blacklisting on logout.
- **Group Management:** Add and manage group members using email query indexing.
- **Expense Logging:** Support for multiple splitting calculations:
  - *Equal Split:* Divided equally among selected members.
  - *Unequal Split:* Customized exact dollar amounts (sums to total).
  - *Percentage Split:* Configured percentages (sums to 100%).
  - *Share Split:* Proportional allocations based on share tokens.
- **Debt Optimization Engine:** Dynamically resolves net group balances and computes optimal "who owes whom" settlement paths at query-time via a greedy matching algorithm.
- **Real-time Expense Comments:** Chat discussion panes on each expense built using Django Channels WebSockets.

---

## Tech Stack
- **Frontend:** React, Vite, React Router, Tailwind CSS, Axios, React Icons, React Hot Toast
- **Backend:** Django, Django REST Framework, Simple JWT, Django Channels (Daphne ASGI)
- **Database:** PostgreSQL (Neon PostgreSQL)
- **Deployment:** Vercel (Frontend), Render (Backend), Neon (Database)

---

## Directory Layout
```
splitWise/
├── backend/            # Django application
│   ├── backend/        # Config and ASGI/WSGI endpoints
│   ├── users/          # Custom auth, search, profiles
│   ├── groups/         # Group ledgers, membership configs
│   ├── expenses/       # Splits logic, settlements, WebSocket chat consumers
│   ├── manage.py
│   └── requirements.txt
├── frontend/           # Vite + React client
│   ├── src/
│   │   ├── components/
│   │   ├── context/    # Global Authentication context
│   │   ├── pages/      # Login, Register, Dashboard, GroupDetails
│   │   ├── services/   # Axios instance with JWT interceptors
│   │   └── index.css   # Main css + Glassmorphic utilities
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Installation & Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (or SQLite fallback configured automatically)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On MacOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and customize values:
   ```bash
   copy .env.example .env
   ```
5. Apply database migrations:
   ```bash
   python manage.py makemigrations users groups expenses
   python manage.py migrate
   ```
6. Spin up the Daphne ASGI development server:
   ```bash
   daphne -b 127.0.0.1 -p 8000 backend.asgi:application
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the local Vite client server:
   ```bash
   npm run dev
   ```
4. Open the browser at `http://localhost:5173`.

---

## Running Automated Tests
To execute backend API tests, validation calculations, and settlement deduction test suites:
```bash
cd backend
python manage.py test
```

---

## Deployment Guidelines

### 1. Database (Neon)
Create a serverless PostgreSQL instance on Neon, copy the connection URL, and specify it as `DATABASE_URL` in the Render backend environment.

### 2. Backend (Render)
- Deploy as a **Web Service**.
- Build command: `pip install -r requirements.txt`.
- Start command: `daphne -b 0.0.0.0 -p $PORT backend.asgi:application` (necessary to support HTTP & WebSockets concurrently).
- Set Environment Variables:
  - `DATABASE_URL` (Neon Postgres URI)
  - `SECRET_KEY` (Django secret)
  - `DEBUG` = `False`
  - `ALLOWED_HOSTS` = `<your-render-subdomain>.onrender.com`
  - `CORS_ALLOWED_ORIGINS` = `https://<your-vercel-subdomain>.vercel.app`

### 3. Frontend (Vercel)
- If you deploy from the `frontend` subfolder, Vercel will build the React app directly.
- Build command: `npm run build`.
- Output directory: `dist`.
- Set Environment Variables:
  - `VITE_API_URL` = `https://<your-render-subdomain>.onrender.com/api/`
  - `VITE_WS_URL` = `wss://<your-render-subdomain>.onrender.com`

### 4. Monorepo Deployment Files
This repository includes configuration files to simplify deployment:
- `render.yaml` — defines both the backend web service and frontend static site on Render.
- `vercel.json` — instructs Vercel to build the frontend from `frontend/package.json`.
- `backend/Procfile` — provides a standard startup command for the Django backend when needed.
- `frontend/.env.example` — example frontend environment variables for Vercel or local builds.

### 5. Render Deployment (recommended)
Use Render with the provided `render.yaml` at the project root:
- Backend service:
  - Root: `backend`
  - Build command: `python -m pip install --upgrade pip && python -m pip install -r requirements.txt`
  - Start command: `python -m daphne -b 0.0.0.0 -p $PORT backend.asgi:application`
  - Environment Vars:
    - `DATABASE_URL`
    - `SECRET_KEY`
    - `DEBUG=False`
    - `ALLOWED_HOSTS=<your-render-subdomain>.onrender.com`
    - `CORS_ALLOWED_ORIGINS=https://<your-vercel-subdomain>.vercel.app`
- Frontend static site:
  - Root: `frontend`
  - Build command: `npm install && npm run build`
  - Publish path: `dist`
  - Environment Vars:
    - `VITE_API_URL=https://<your-render-subdomain>.onrender.com/api/`
    - `VITE_WS_URL=wss://<your-render-subdomain>.onrender.com`

#### Render troubleshooting for exit 127
If Render shows `Exited with status 127`, it usually means the command could not be found in the environment. The recommended fix is to use module execution with `python -m` for both package installation and Daphne startup.

### 6. Vercel Deployment
If you deploy only the frontend on Vercel:
- Use `frontend` as the deployment root.
- Build command: `npm run build`.
- Output directory: `dist`.
- Environment variables must reference your Render backend URL:
  - `VITE_API_URL=https://<your-render-subdomain>.onrender.com/api/`
  - `VITE_WS_URL=wss://<your-render-subdomain>.onrender.com`

> Tip: If you want to run the frontend locally with the same env naming, copy `frontend/.env.example` to `frontend/.env` and update the backend host.
