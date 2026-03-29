# 🚀 ProcureFlow — B2B Purchase Request Approval System

A full-stack **B2B procurement workflow platform** that enables organizations to manage purchase requests with **role-based approvals**.

🔗 **Live Demo:** http://54.252.200.104:4000/

---

## ✨ Features

* 🏢 Multi-organization support
* 🔐 Role-based access control:

  * **Admin** – manage org & members
  * **Approver** – approve/reject requests
  * **Member** – create requests
* 🔄 Request lifecycle:

  * `draft → pending → approved / rejected`
* 📊 Dashboard with real-time updates
* 🔑 JWT authentication & secure password hashing

---

## 🛠 Tech Stack

### Backend

* Node.js + Express + TypeScript
* SQLite (`better-sqlite3`)
* Zod (validation)
* JWT (authentication)
* bcrypt (password hashing)

### Frontend

* React 18 + TypeScript
* Vite
* TanStack Query
* React Router
* Tailwind CSS

---

## ⚙️ Local Setup

```bash
git clone https://github.com/your-username/b2b-platform.git
cd b2b-platform
npm install
cp backend/.env.example backend/.env
```

Edit `.env`:

```env
JWT_SECRET=your-super-secret-key
```

---

## ▶️ Run Locally

### Terminal A (Backend)

```bash
cd backend
npm run dev
```

### Terminal B (Frontend)

```bash
cd frontend
npm run dev
```

Open:

```
http://localhost:5173
```

---

## 🏗 Production Build

```bash
cd b2b-platform
npm run build
npm run start
```

App runs on:

```
http://localhost:4000
```

---

## 🌐 Deployment (AWS EC2)

* Deployed on AWS EC2 (Ubuntu)
* Node.js app running via PM2
* Reverse proxy handled via Nginx (optional)
* SQLite database stored on persistent volume

### Steps:

1. Launch EC2 instance (t2.micro)
2. Install Node.js & Git
3. Clone repo & install dependencies
4. Configure `.env`
5. Build and start app

---

## 📡 API Overview

| Method | Endpoint                    | Description    |
| ------ | --------------------------- | -------------- |
| POST   | `/api/auth/register`        | Register user  |
| POST   | `/api/auth/login`           | Login          |
| GET    | `/api/auth/me`              | Current user   |
| POST   | `/api/orgs`                 | Create org     |
| POST   | `/api/orgs/:id/members`     | Add member     |
| POST   | `/api/requests/:id/submit`  | Submit request |
| POST   | `/api/requests/:id/approve` | Approve        |
| POST   | `/api/requests/:id/reject`  | Reject         |

---

## 🔒 Security

* Password hashing with bcrypt
* JWT-based authentication
* Role-based authorization
* Environment-based secrets

---

## 📈 Future Improvements

* OAuth / OIDC (Auth0 / Keycloak)
* PostgreSQL instead of SQLite
* Docker + containerization
* CI/CD with GitHub Actions
* AWS infra (ECR, ECS, Terraform)
* Logging & monitoring

---

## 💡 Why this project?

This project demonstrates:

* Full-stack system design
* Real-world B2B workflow modeling
* Authentication & authorization
* Production deployment (AWS)

---

## 👤 Author

**Shyamal Kudupudi**
Computer Science Student | Aspiring Software Engineer

---
