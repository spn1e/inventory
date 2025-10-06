# Smart Inventory Management System

A complete, AI-powered inventory management system with demand forecasting and automated reorder recommendations. Built with React, Node.js, FastAPI, and PostgreSQL, featuring real-time updates and machine learning-driven insights.

[![CI Pipeline](https://github.com/your-username/smart-inventory/workflows/CI%20Pipeline/badge.svg)](https://github.com/your-username/smart-inventory/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

### Core Functionality
- **📊 Real-time Dashboard** - Interactive overview of inventory metrics, sales trends, and alerts
- **📦 Inventory Management** - Complete CRUD operations for inventory items with stock tracking
- **📈 Sales Data Upload** - Bulk import of sales history via CSV/Excel files with validation
- **🔮 AI-Powered Forecasting** - Prophet-based demand prediction with confidence intervals
- **🔄 Automated Reorder Recommendations** - Smart reorder suggestions based on forecasts and stock levels
- **⚡ Real-time Updates** - Socket.io powered live notifications and data synchronization

### Technical Highlights
- **🐳 Fully Containerized** - Docker Compose setup for easy local deployment
- **🧪 Comprehensive Testing** - Unit tests for backend and ML components
- **🚀 CI/CD Pipeline** - GitHub Actions for automated testing and building
- **📱 Responsive UI** - Modern React interface with real-time charts and notifications
- **🔐 Authentication** - JWT-based security with role-based access
- **📊 MLflow Integration** - Experiment tracking and model versioning

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend     │    │   ML Service   │
│   React + Vite  │◄──►│  Node.js + Express│◄──►│  FastAPI + Prophet│
│   Port: 5173    │    │   Port: 3000    │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   PostgreSQL    │              │
         └──────────────┤   Database      │──────────────┘
                        │   Port: 5432    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │     Redis       │
                        │  (Job Queue)    │
                        │   Port: 6379    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │    MLflow UI    │
                        │ (Experiment     │
                        │  Tracking)      │
                        │   Port: 5000    │
                        └─────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 with Vite for fast development
- Recharts for interactive data visualization
- Socket.io-client for real-time updates
- Tailwind CSS for modern styling
- React Hook Form for form management

**Backend:**
- Node.js with Express.js framework
- Knex.js for database migrations and queries
- Socket.io for real-time communication
- JWT authentication with bcrypt
- Joi for request validation
- Winston for logging

**ML Service:**
- FastAPI for high-performance API
- Prophet for time series forecasting
- MLflow for experiment tracking
- Pandas and NumPy for data processing
- Scikit-learn for model evaluation
- Joblib for model serialization

**Database & Infrastructure:**
- PostgreSQL for persistent data storage
- Redis for job queuing and caching
- Docker & Docker Compose for containerization
- GitHub Actions for CI/CD

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### 1. Clone and Start

```bash
# Clone the repository
git clone https://github.com/your-username/smart-inventory.git
cd smart-inventory

# Start all services
docker-compose up --build

# Wait for all services to start (takes 2-3 minutes)
```

### 2. Seed Sample Data

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Seed the database with sample data
./scripts/seed_sample_data.sh
```

### 3. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **ML Service:** http://localhost:8000
- **MLflow UI:** http://localhost:5000

**Login Credentials:** `admin` / `password`

## 📋 Acceptance Tests

Run these manual tests to verify the system is working correctly:

### ✅ Test 1: System Startup
```bash
# Start the system
docker-compose up --build

# Verify all services are healthy
curl -f http://localhost:3000/health  # Backend
curl -f http://localhost:8000/health  # ML Service  
curl -f http://localhost:5173         # Frontend
curl -f http://localhost:5000/health  # MLflow (optional)

# Expected: All endpoints return 200 OK
```

### ✅ Test 2: Authentication
```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Expected: Returns JWT token and user info
```

### ✅ Test 3: Sample Data Loading
```bash
# Run the seed script
./scripts/seed_sample_data.sh

# Verify items were created
curl http://localhost:3000/api/items

# Expected: Returns array with 3 sample items (WIDGET-001, GADGET-002, TOOL-003)
```

### ✅ Test 4: Sales Data Upload
```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Upload sample sales data
curl -X POST http://localhost:3000/api/upload/sales \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_data/sales_sample.csv"

# Expected: Returns success with processed row count
```

### ✅ Test 5: Demand Forecasting
```bash
# Request forecast generation
./scripts/request_forecast.sh WIDGET-001 30

# Or manually:
curl -X POST http://localhost:3000/api/forecast/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sku": "WIDGET-001", "horizon_days": 30}'

# Expected: Returns forecast array with 30 data points
```

### ✅ Test 6: Reorder Recommendations
```bash
# Get reorder suggestions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/reorder/suggestions

# Expected: Returns reorder suggestions based on stock levels and forecasts
```

### ✅ Test 7: Real-time Updates
1. Open the frontend at http://localhost:5173
2. Login with `admin` / `password`
3. In another tab, upload sales data via the Upload page
4. Verify real-time notifications appear in the original tab

### ✅ Test 8: Frontend UI Validation
1. **Dashboard:** Shows inventory metrics, charts, and recent activity
2. **Items Page:** Lists all inventory items with filtering options
3. **Item Detail:** Shows item info, forecast chart, and sales history
4. **Upload Page:** Allows CSV/Excel file upload with validation

## 🛠️ Development Setup

### Local Development (without Docker)

#### Backend Setup
```bash
cd backend
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Start development server
npm run dev
```

#### Frontend Setup  
```bash
cd frontend
npm install

# Start development server
npm run dev
```

#### ML Service Setup
```bash
cd ml_service
pip install -r requirements.txt

# Start development server
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## 📡 API Documentation

### Authentication Endpoints

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

# Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "username": "admin",
    "email": "admin@inventory.com"
  }
}
```

### Inventory Endpoints

#### Get All Items
```bash
GET /api/items?category=Electronics&low_stock=true

# Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sku": "WIDGET-001",
      "name": "Smart Widget Pro",
      "category": "Electronics",
      "current_stock": 75,
      "reorder_point": 50,
      "supplier_name": "TechSupply Corp"
    }
  ],
  "count": 1
}
```

#### Get Item by SKU
```bash
GET /api/items/WIDGET-001

# Response includes item details, recent sales, and latest forecast
```

#### Create Item
```bash
POST /api/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "NEW-001",
  "name": "New Product",
  "category": "Electronics", 
  "cost_price": 29.99,
  "reorder_point": 20,
  "reorder_qty": 100,
  "current_stock": 50
}
```

### Sales Endpoints

#### Upload Sales Data
```bash
POST /api/upload/sales
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Form data: file=@sales_data.csv
```

#### Get Sales Analytics
```bash
GET /api/sales/analytics/summary?days=30

# Returns sales summary, trends, and top products
```

### Forecasting Endpoints

#### Generate Forecast
```bash
POST /api/forecast/predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "WIDGET-001",
  "horizon_days": 30
}

# Response:
{
  "success": true,
  "data": {
    "sku": "WIDGET-001",
    "horizon_days": 30,
    "forecast": [
      {
        "date": "2024-01-01",
        "yhat": 15.5,
        "yhat_lower": 12.3,
        "yhat_upper": 18.7
      }
    ],
    "model_metrics": {
      "mae": 2.1,
      "mape": 8.5,
      "accuracy_category": "Good"
    }
  }
}
```

#### Get Latest Forecast
```bash
GET /api/forecast/WIDGET-001/latest?days=30
```

### Reorder Endpoints

#### Get Reorder Suggestions
```bash
GET /api/reorder/suggestions
Authorization: Bearer <token>

# Response:
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "sku": "WIDGET-001",
        "name": "Smart Widget Pro",
        "current_stock": 15,
        "reorder_point": 50,
        "recommended_order_qty": 75,
        "analytics": {
          "urgency_score": 8.5,
          "days_remaining": 12
        }
      }
    ]
  }
}
```

#### Create Purchase Order
```bash
POST /api/purchase-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "WIDGET-001",
  "qty": 100,
  "supplier_id": "supplier-uuid",
  "unit_cost": 20.00
}
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test

# With coverage
npm run test -- --coverage

# Watch mode
npm run test:watch
```

### ML Service Tests
```bash
cd ml_service
pytest test_train.py -v

# With coverage
pytest test_train.py -v --cov=train --cov=inference
```

### Integration Tests
```bash
# Start all services
docker-compose up -d --build

# Run integration tests
.github/workflows/ci.yml # (via GitHub Actions)
```

### Manual Testing Checklist

- [ ] System starts without errors
- [ ] Authentication works correctly
- [ ] Sample data loads successfully
- [ ] Sales data upload processes correctly
- [ ] Forecasts generate with valid predictions
- [ ] Reorder suggestions calculate properly
- [ ] Real-time notifications work
- [ ] All UI pages load and function
- [ ] Error handling works gracefully

## 🚢 Deployment

### Production Deployment

1. **Environment Variables**
```bash
# Create production environment file
cp .env.example .env.production

# Update with production values:
# - Database credentials
# - JWT secrets
# - External service URLs
```

2. **Database Setup**
```bash
# Run migrations in production
docker-compose exec backend npm run migrate
```

3. **SSL/TLS Setup**
```bash
# Add reverse proxy (nginx/traefik) configuration
# Update docker-compose.yml with SSL certificates
```

4. **Monitoring**
```bash
# Add monitoring tools (Prometheus, Grafana)
# Setup log aggregation (ELK stack)
# Configure alerting
```

### Performance Tuning

- **Database**: Add indexes, connection pooling
- **Backend**: Enable compression, caching
- **Frontend**: Build optimization, CDN
- **ML Service**: Model caching, batch processing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure CI pipeline passes

## 🔧 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check ports are available
sudo lsof -i :3000 -i :5173 -i :8000 -i :5432

# Clean up Docker
docker-compose down -v
docker system prune -f
```

**Database connection issues:**
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up postgres
```

**ML Service errors:**
```bash
# Check Python dependencies
docker-compose exec ml_service pip list

# View ML service logs
docker-compose logs ml_service
```

**Frontend not loading:**
```bash
# Clear browser cache
# Check frontend build
docker-compose exec frontend npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Prophet** by Facebook for time series forecasting
- **React** team for the excellent frontend framework  
- **FastAPI** for the high-performance Python web framework
- **PostgreSQL** for reliable data storage
- **Docker** for containerization capabilities

## 📞 Support

For questions, issues, or contributions:

- 📧 Email: support@smartinventory.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/smart-inventory/issues)
- 📖 Documentation: [Wiki](https://github.com/your-username/smart-inventory/wiki)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/smart-inventory/discussions)

---

Built with ❤️ using modern web technologies and AI/ML best practices.