# Chanjo Vaccination Tracker

A full-stack application that help mothers track and schedule their babies' vaccinations, with automated reminders via email.

## Features

* **User Authentication**: Sign up with email, login, password reset flows.
* **Profile Management**: Store mother and multiple baby profiles.
* **Vaccination Schedule**: View vaccine schedules customized per baby.
* **Automated Reminders**: Reminder emails sent a week and a day before upcoming vaccinations.
<!-- * **Admin Dashboard**: Mark vaccines as administered. -->
* **Multi-Baby Support**: Easily switch between babies in the dashboard.

## Tech Stack

* **Frontend**: TypeScript, React, Vite, Shadcn/ui components, Tailwind CSS
* **Backend**: Node.js, Express, MongoDB (Atlas), JWT
* **Email**: Nodemailer (Gmail SMTP)
* **Scheduling**: Node-Cron for reminder jobs
* **Hosting**: Railway (backend), Netlify (frontend)

## Folder Structure
.
├── README.md
├── backend
│   ├── db.js
│   ├── package-lock.json
│   ├── package.json
│   ├── schedules.json
│   ├── server.js
├
├── frontend
│   ├── README.md
│   ├── components.json
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── components
│   │   │   ├── AddBabyForm.tsx
│   │   │   ├── ColumnResizer.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProfileForm.tsx
│   │   │   ├── ResetPasswordForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   ├── calculateSchedule.tsx
│   │   │   ├── columns.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── mode-toggle.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── ui
│   │   ├── index.css
│   │   ├── lib
│   │   │   └── utils.ts
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts

## Getting Started

### Prerequisites

* Node.js
* MongoDB
* React + Vite + TypeScript
* Email account for sending emails

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/<your-username>/vaccination-tracker.git
   cd vaccination-tracker
   ```

2. **Backend**

   ```bash
   cd backend
   npm install
   ```

   * Create a `.env` in `backend/`:

     ```ini
     PORT=5000
     JWT_SECRET=your_jwt_secret
     MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/vaccination_tracker
     EMAIL_USER=your@gmail.com
     EMAIL_PASS=app_specific_password
     ```

   * Start the server:

     ```bash
     npm run dev
     ```

3. **Frontend**

   ```bash
   cd frontend
   npm install
   ```

   * Create `.env` in `frontend/`:

     ```ini
     VITE_BACKEND_URL=http://localhost:5000
     ```

   * Start the client:

     ```bash
     npm run dev
     ```

4. **Schema Setup**

   * Run the `setup_schema.js` script against your MongoDB cluster:

     ```bash
     mongosh "${MONGODB_URI}" --file setup_schema.js
     ```

### API Endpoints

| Method | Route                               | Description                          |
| ------ | ----------------------------------- | ------------------------------------ |
| POST   | `/api/signup`                       | Register, email temp password        |
| POST   | `/api/reset-password`               | Reset password                       |
| POST   | `/api/login`                        | Authenticate and issue JWT           |
| GET    | `/api/profile`                      | Get mother & babies                  |
| POST   | `/api/profile`                      | Create/update profile                |
| POST   | `/api/baby`                         | Add a new baby                       |
| PUT    | `/api/baby/:id/birth-date`          | Update baby's birth date & reminders |
| GET    | `/api/vaccination-schedule/:babyId` | Get reminders schedule per baby      |
| POST   | `/api/reminder/:babyId`             | Regenerate reminders for baby        |
| PUT    | `/api/reminder/:id/administered`    | Toggle administered status           |

### Deployment

* **Backend**: Push to your GitHub, connect to Railway service. Add MongoDB plugin and set `MONGODB_URI`, `JWT_SECRET`, `EMAIL_*` as environment variables. Bind Express on `0.0.0.0`.
* **Frontend**: Deploy to Netlify. Set `VITE_BACKEND_URL` to your Railway URL.