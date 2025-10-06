# Inventory Management & Demand Forecasting

AI-assisted inventory platform with React UI, Node/Express API, and a Python FastAPI microservice for time‑series forecasting. Fully containerized with PostgreSQL and Docker Compose.


## Features

- Real-time dashboard and notifications for inventory events
- Inventory CRUD with validation, categories, and supplier metadata
- Secure authentication (JWT) with sample admin user
- Sales data ingestion via CSV/Excel with server-side validation and error reporting
- On-demand demand forecasting (Prophet) exposed through the ML service and persisted to DB
- File uploads with size/type checks and temporary storage cleanup
- Knex migrations for suppliers, items, sales, forecasts, alerts and purchase orders
- Containerized dev environment (frontend, backend, ML, Postgres, Redis, MLflow)
- API tests for auth and inventory, plus an example ML test


## Tech Stack

- Frontend: React 18 + Vite
- Backend: Node.js, Express, Knex
- ML Service: FastAPI (Python), Prophet, Pandas/NumPy, Joblib
- Database: PostgreSQL
- Realtime: Socket.io
- DevOps: Docker, Docker Compose
- Testing: Jest + Supertest (backend), Pytest (ML)


## Architecture

Frontend (Vite/React) ↔ Backend (Express) ↔ PostgreSQL
                     ↘ ML Service (FastAPI/Prophet)

- Backend exposes REST APIs and communicates with the ML service over HTTP.
- Forecast outputs are stored in the forecasts table for retrieval by the UI.
- Redis and MLflow are wired in docker-compose for future extensions and experiment tracking.


## Quick Start (Docker)

Prerequisites: Docker, Docker Compose, Git

```bash
git clone https://github.com/spn1e/inventory.git
cd inventory
docker-compose up --build
```

First run can take a few minutes. Services start in this order: Postgres → Redis/MLflow → ML service → Backend → Frontend.

Services and URLs:
- Frontend: http://localhost:5174
- Backend API: http://localhost:3001
- ML Service: http://localhost:8001
- MLflow UI: http://localhost:5000

Default login:
- username: admin
- password: password


## How to Use

1) Log in
- Open the frontend at http://localhost:5174 and sign in with the default credentials.

2) Create inventory items
- Use the UI Items page, or call the API:
```bash
curl -X POST http://localhost:3001/api/items \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-001",
    "name": "Sample Item",
    "category": "General",
    "reorder_point": 20,
    "reorder_qty": 50,
    "current_stock": 40
  }'
```

3) Upload sales history (CSV/Excel)
- Download a template:
```bash
curl http://localhost:3001/api/upload/template -o sales_template.csv
```
- Upload using the UI Upload page, or the API:
```bash
curl -X POST http://localhost:3001/api/upload/sales \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@sales_template.csv"
```

4) Generate a forecast
- From UI: open an Item Detail page and trigger forecasting if available.
- From API:
```bash
curl -X POST http://localhost:3001/api/forecast/predict \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-001","horizon_days":30}'
```

5) Retrieve the latest forecast (for charts/analysis)
```bash
curl "http://localhost:3001/api/forecast/SKU-001/latest?days=30"
```


## Configuration

Environment variables are set via docker-compose. Key ones:
- Backend: NODE_ENV, DATABASE_URL, ML_SERVICE_URL, JWT_SECRET, UPLOAD_MAX_SIZE, FRONTEND_URL
- ML Service: DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE), MLFLOW_TRACKING_URI, REDIS_URL
- Postgres: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

To change ports or secrets, edit [`docker-compose.yml`](docker-compose.yml).


## Local Development (without Docker)

Backend
```bash
cd backend
npm install
# configure a local Postgres and set DATABASE_URL
npm run migrate
npm run dev
```

Frontend
```bash
cd frontend
npm install
npm run dev
```

ML Service
```bash
cd ml_service
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```


## Testing

Backend (Jest + Supertest)
```bash
cd backend
npm test
```

ML Service (Pytest)
```bash
cd ml_service
pytest test_train.py -v
```


## Project Structure

- Backend API: [`backend/src/app.js`](backend/src/app.js), routes: [`backend/src/routes/`](backend/src/routes/)
- DB Migrations: [`backend/src/db/migrations/`](backend/src/db/migrations/)
- Frontend app: [`frontend/src/`](frontend/src/)
- ML service: [`ml_service/`](ml_service/)
- Orchestration: [`docker-compose.yml`](docker-compose.yml)
- Utility scripts: [`scripts/`](scripts/)


## Notable Endpoints

- Auth: POST /api/auth/login
- Items: GET /api/items, GET /api/items/:sku, POST /api/items, PUT /api/items/:sku, DELETE /api/items/:sku
- Upload: POST /api/upload/sales, GET /api/upload/template
- Forecast: POST /api/forecast/predict, GET /api/forecast/:sku/latest

See route implementations in [`backend/src/routes/auth.js`](backend/src/routes/auth.js), [`backend/src/routes/items.js`](backend/src/routes/items.js), [`backend/src/routes/upload.js`](backend/src/routes/upload.js), [`backend/src/routes/forecast.js`](backend/src/routes/forecast.js) and ML entrypoint in [`ml_service/app.py`](ml_service/app.py).


## Notes

- Default credentials are for local development only; configure JWT_SECRET and real users for production.
- Ensure sufficient sales history exists for a SKU before generating forecasts.
- Large file uploads are limited by UPLOAD_MAX_SIZE (default 10MB).


---

Built for reliability and ease of onboarding: one command to run, clear APIs, and modular services.