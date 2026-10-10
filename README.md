# Sales CRM — Server Startup Guide

This document describes how to start and run the Sales CRM application using Docker Compose or local development servers.

---

## 1. Quick Start on Windows (One-Click)

Double click or execute from terminal:
- **`start-all.bat`**: Launches both backend (Django) and frontend (Vite) in separate console windows.
- Or launch individually:
  - **`start-backend.bat`** (Starts Django API server on `http://127.0.0.1:8000`)
  - **`start-frontend.bat`** (Starts Vite Frontend on `http://localhost:5173`)

### Skill Move User Accounts (Password: `ADmin@123`)
- **Admin**: `admin@skillmove.com` (Full access, lead cross-team assignment, reporting, stages)
- **Manager**: `manager@skillmove.com` (Assigned to *Skill Move Admissions Team*)
- **Counsellor**: `counsellor@skillmove.com` (Sales Employee, *Skill Move Admissions Team*)
- Legacy Superuser: `root` / `root`

---

## 2. Quick Start with Docker Compose (Alternative)

To run the complete stack (PostgreSQL, Redis, Django API, Celery Worker, Celery Beat, and React Frontend):

1. **Configure Environment Variables**:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```

2. **Build and Run Containers**:
   ```bash
   docker compose up --build
   ```

3. **Access Services**:
   - **Frontend Application**: `http://localhost`
   - **Backend API**: `http://localhost:8000/api/`
   - **Admin Portal**: `http://localhost:8000/admin/`

---

## 2. Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+ and npm
- Redis (optional for local Celery)

### Backend Startup

1. **Activate Virtual Environment**:
   - Windows PowerShell:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - Linux/macOS:
     ```bash
     source venv/bin/activate
     ```

2. **Install Dependencies** (if not already installed):
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Apply Database Migrations**:
   ```bash
   python backend/manage.py migrate
   ```

4. **Create an Initial Admin User** (if required):
   ```bash
   python backend/manage.py createsuperuser
   ```

5. **Start Django API Server**:
   ```bash
   python backend/manage.py runserver 127.0.0.1:8000
   ```
   The backend API will run at `http://127.0.0.1:8000/`.

---

### Celery Background Worker & Beat (Optional for Local Async Tasks)

Ensure Redis is running locally on port 6379, then run:

- **Celery Worker**:
  ```bash
  celery -A crm_project --workdir backend worker -l info
  ```

- **Celery Beat (Scheduler)**:
  ```bash
  celery -A crm_project --workdir backend beat -l info
  ```

---

### Frontend Startup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies** (if not already installed):
   ```bash
   npm install
   ```

3. **Start Vite Development Server**:
   ```bash
   npm run dev
   ```
   The frontend will run at `http://localhost:5173/` and proxies `/api` requests to `http://127.0.0.1:8000`.

---

## 3. Running Automated Tests

### Backend Tests (Pytest)
From project root:
```bash
python -m pytest backend/
```

### Frontend Tests (Vitest)
From `frontend/` directory:
```bash
npm run test
```

### Frontend Production Build
From `frontend/` directory:
```bash
npm run build
```
