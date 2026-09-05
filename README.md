# TokTickIT

IT Service Desk application built with React, Vite, Express, Prisma, and PostgreSQL.

## Prerequisites
- Node.js (v18+)
- Docker Desktop

## Installation & Setup
 
1. **Install Dependencies:**
   - **Root (Playwright & Dev Tools):**
     ```bash
     npm install
     ```
   - **Server:**
     ```bash
     cd server && npm install
     ```
   - **Client:**
     ```bash
     cd client && npm install
     ```

2. **Start PostgreSQL via Docker Compose:**
   ```bash
   docker compose up -d
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` inside the `server` directory:
   ```bash
   cd server
   cp .env.example .env
   ```

4. **Sync Database Schema & Seed Data:**
   ```bash
   cd server
   npx prisma db push
   npm run prisma:seed
   ```

## Running the Application

- **Backend Server (`/server`):**
  ```bash
  cd server
  npm run dev
  ```
  Runs at `http://localhost:3000`

- **Frontend Client (`/client`):**
  ```bash
  cd client
  npm run dev
  ```
  Runs at `http://localhost:5173`

## Running Tests

- **Client Component Tests:**
  ```bash
  cd client && npm test
  ```
- **Server API & Unit Tests:**
  ```bash
  cd server && npm test
  ```
- **End-to-End Tests (Playwright):**
  ```bash
  npm run test:e2e
  # or
  npx playwright test
  ```
 
