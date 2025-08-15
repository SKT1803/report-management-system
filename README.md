# Report Management System

A lightweight daily report & hours tracking app with role-based dashboards, department analytics, and company-wide insights. Built with React + Vite on the frontend and Go (Gin) + MongoDB on the backend. Deployed on Vercel (FE) and Render (BE).


Superadmin + per department Admin/Employee demo accounts are already provisioned on the live server use them to try the app end-to-end.

🌐 Live on vercel: [report-management-system](https://report-management-system-one.vercel.app)

Demo Credentials (pre-created)

```powershell

Superadmin
  email: superadmin@example.com
  password : 123

Admin (e.g., Sales)
  email: sales.admin@example.com
  password : 123

Employee (e.g., Sales)
  email: sales.employee01@example.com
  password : 123

```


<table>
  <tr>
    <td><img src="images/1.png" width="1000"></td>
  </tr>
</table>


---

## Features 

- **Daily Reports**: Employees submit hours + text content per day.

- **Smart Search**: Full-text search across report content; filter by department/date.

- **Employee Management**: Status per day (“Report Submitted” / “No Report”), recent history, inline preview.

- **Department Analytics**: Time-series charts (7d, 30d, 6m, 12m), totals, averages, top contributors.

- **Compare Employees**: Multi-series trend lines to compare contributors within a department.

- **Company Overview (Superadmin)**: Global stats + department overview (employees, reports today, avg hours per selected period) and department comparison charts.

- **Reminders/Messages**: Send department-targeted or org-wide announcements; auto-expire.

- **Export**s: One-click export (CSV/PNG) for charts (front-end option).(!!! this feature is currently not working properly.)

- **Role-Based Access Control**: Superadmin / Admin / Employee, with clear, scoped permissions.

- **SPA-safe Routing**: Production rewrite rules so deep links/refreshes work.


---


## Roles & Permissions

### Superadmin

  - See company-wide overview, analytics, and comparisons across **all departments**.
  
  - Switch department context in analytics.
  
  - Manage reminders company-wide.
  
  - Add users (single or CSV) **with any role (admin/employee)** to **any department**.
  
  - Browse all employees by department; preview recent reports.
  
  - No “My Activity” section (since superadmin doesn’t submit reports).

### Admin (per-department)

  - Full analytics **for their department** (hours trends, stats, top contributors).
  
  - Compare employees **within their department**.
  
  - Browse and manage employees **within their department**.
  
  - Create reminders to their department.
  
  - Add employees (single/CSV) **as employees** into their department.
  
  - Has personal daily report flow (write/edit/search own reports).

### Employee

  - Submit/edit daily reports (hours + content).
  
  - View personal history and basic analytics (“My Activity”).
  
  - Read department reminders.


---

## Tech Stack

### Frontend
  
  - React + Vite
  
  - React Router
  
  - Recharts (charts)
  
  - Lucide React (icons)
  
  - anilla/CSS modules (custom styles)
  
  - Small toast system (global notifications)

### Backend

- Go (Gin)

- MongoDB (official Go driver)

- JWT (golang-jwt)

- bcrypt (password hashing)

- CORS, dotenv

Infra (deployment + db)

- Vercel (frontend)

- Render (backend)

- MongoDB Atlas


---

## Running the Project (Local)

### Prerequisites

- **Go** ≥ 1.22 (install the latest stable)

- **Node.js** ≥ 18 and **npm**

- A **MongoDB** connection string (Atlas or local)

> The app seeds the **Departments** collection on first run, so you don’t need a manual seed step.

### 1) First-time setup

**1.1 Clone the repo**

    git clone https://github.com/<your-user>/<your-repo>.git
    cd <your-repo>

**1.2 Create env files**

Backend (backend/.env)

    PORT=5000
    MONGO_URI=<your-mongodb-uri>
    JWT_SECRET=<a-long-random-secret>
    # Optional in local (CORS already allows localhost:5173)
    # CLIENT_URL=http://localhost:5173


Frontend (frontend/.env)

    VITE_API_URL=http://localhost:5000/api


**1.3 Install dependencies**

Backend

    cd backend
    go mod download  

Frontend

    cd frontend
    npm install


### 2) Run (first time & every time)

You’ll run two terminals:one for backend, one for frontend.

Terminal A – Backend

    cd backend
    go run main.go
    # API up at http://localhost:5000

Terminal B – Frontend

    cd frontend
    npm run dev
    # App up at http://localhost:5173

Open http://localhost:5173 in your browser and log in.


### 3) Subsequent runs (after the first day)


You don’t need to reinstall anything unless dependencies changed.

Backend

    cd backend
    go run main.go

Frontend

    cd frontend
    npm run dev


### Notes & Tips

- **CORS (local)**: Already whitelisted for `http://localhost:5173` and `http://127.0.0.1:5173`. `CLIENT_URL` is **not required** locally.

- **CORS (prod)**: When deployed, set `CLIENT_URL` on the backend to your Vercel URL, and set `VITE_API_URL` on the frontend to your backend’s `/api` base.

- **Ports**: Backend defaults to `:5000`; Frontend (Vite) defaults to `:5173`.

- **Mongo**: Use Atlas or a local MongoDB; just point `MONGO_URI` to the right place.

- **Auto seed**: `Departments` indexes + seed run automatically on backend start if empty.


