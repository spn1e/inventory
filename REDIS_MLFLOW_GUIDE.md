# 🔴 Redis & 📊 MLflow Guide for Inventory System

## 🔴 **Redis - The Lightning-Fast Cache**

### 🤔 **What is Redis?**
Redis is an **in-memory data structure store** that acts as:
- **Cache**: Store frequently accessed data for super-fast retrieval
- **Session Store**: Keep user sessions and temporary data
- **Message Broker**: Handle real-time communications
- **Counter**: Track metrics and statistics in real-time

### ⚡ **Why Redis is FAST:**
- Stores data in **RAM** (not disk) → 100x faster than databases
- Simple key-value operations → microsecond response times
- Built-in data structures → efficient operations

### 🎯 **How Redis is Used in Your Inventory System:**

#### 1. **API Response Caching**
```redis
# Cache expensive database queries
SET "cache:items:all" '{"items":[...]}' EX 300
SET "cache:sales:summary:30days" '{"total":1000}' EX 1800
```

#### 2. **Session Management** 
```redis
# Store user sessions
SET "session:admin:abc123" '{"user_id":"1","role":"admin"}' EX 3600
```

#### 3. **Real-time Counters**
```redis
# Track system metrics
INCR "stats:api_calls_today"
INCR "stats:forecasts_generated" 
INCR "stats:items_created"
```

#### 4. **Temporary Data Storage**
```redis
# Store processing results
SET "processing:forecast:WIDGET-001" "in_progress" EX 600
```

### 💻 **How to Use Redis:**

#### **Method 1: Using our helper script**
```powershell
. .\redis_helper.ps1

# Basic operations
Redis-Set "my_key" "my_value"
Redis-Get "my_key"
Redis-Keys "*"

# Inventory-specific
Cache-InventoryItem "WIDGET-001" "Smart Widget" 10 25.99
Get-CachedItem "WIDGET-001"
Increment-Counter "sales_today"
```

#### **Method 2: Direct Redis CLI**
```powershell
# Connect to Redis
docker exec -it inventory-redis-1 redis-cli

# Inside Redis CLI:
SET mykey "myvalue"
GET mykey
KEYS *
INFO memory
```

### 📊 **Redis Data Types:**

1. **Strings**: Simple key-value pairs
2. **Hashes**: Objects with multiple fields
3. **Lists**: Ordered collections
4. **Sets**: Unique collections
5. **Sorted Sets**: Ordered unique collections
6. **Streams**: Event logs

---

## 📊 **MLflow - The ML Experiment Tracker**

### 🤔 **What is MLflow?**
MLflow is a **machine learning lifecycle management platform** that helps you:
- **Track experiments**: Record ML model training runs
- **Compare models**: See which performs better
- **Store models**: Version and deploy ML models
- **Monitor performance**: Track model accuracy over time

### 🎯 **How MLflow is Used in Your Inventory System:**

#### 1. **Demand Forecasting Models**
Your ML service trains Prophet models for each SKU:
- **WIDGET-001**: Predicts daily sales
- **GADGET-002**: Forecasts demand trends
- **TOOL-003**: Estimates inventory needs

#### 2. **Model Versioning**
```python
# Each model training run is tracked
mlflow.log_param("sku", "WIDGET-001")
mlflow.log_param("model_type", "prophet")
mlflow.log_metric("mae", 10.96)  # Mean Absolute Error
mlflow.log_metric("rmse", 11.86) # Root Mean Square Error
```

#### 3. **Performance Monitoring**
- Track model accuracy over time
- Compare different algorithms
- Identify when models need retraining

### 📈 **Your Current ML Models:**

Based on our testing, you have **3 trained models**:

| SKU | Model | MAE | RMSE | Accuracy |
|-----|-------|-----|------|----------|
| WIDGET-001 | Prophet | 10.96 | 11.86 | Poor |
| GADGET-002 | Prophet | 6.08 | 6.75 | Poor |
| TOOL-003 | Prophet | 5.44 | 6.30 | Poor |

*Note: "Poor" accuracy is normal with limited historical data*

### 🌐 **How to Use MLflow:**

#### **Method 1: Web Interface**
1. Open browser: http://localhost:5000
2. Browse experiments and runs
3. Compare model performance
4. Download trained models

#### **Method 2: MLflow API**
```powershell
# List experiments
Invoke-WebRequest "http://localhost:5000/api/2.0/mlflow/experiments/search"

# Get runs for an experiment
Invoke-WebRequest "http://localhost:5000/api/2.0/mlflow/runs/search"
```

#### **Method 3: Through Your Backend API**
```powershell
# Generate new forecast (automatically logged to MLflow)
$headers = @{'Authorization' = 'Bearer YOUR_TOKEN'}
Invoke-WebRequest -Uri "http://localhost:3001/api/forecast/predict" -Method POST -Headers $headers -Body '{"sku":"WIDGET-001","horizon_days":30}'
```

---

## 🔗 **How Redis & MLflow Work Together**

### **Workflow Example:**
1. **User requests forecast** → API call
2. **Check Redis cache** → `cache:forecast:WIDGET-001:30days`
3. **If cached**: Return immediately (fast!)
4. **If not cached**: 
   - Generate forecast using MLflow model
   - Log performance to MLflow
   - Store result in Redis cache
   - Return forecast to user

### **Performance Benefits:**
- **Without cache**: 5-10 seconds (ML computation)
- **With Redis cache**: 50 milliseconds (cached result)
- **200x faster!**

---

## 🛠️ **Practical Examples**

### **Cache Inventory Data:**
```powershell
. .\redis_helper.ps1

# Cache frequently accessed items
Cache-InventoryItem "WIDGET-001" "Smart Widget Pro" 10 25.99 300

# Retrieve cached data
Get-CachedItem "WIDGET-001"
```

### **Track ML Performance:**
1. Visit http://localhost:5000
2. Click on "inventory_forecasting" experiment  
3. View model runs and metrics
4. Compare different training sessions

### **Real-time Analytics:**
```powershell
# Track system usage
Increment-Counter "api_calls"
Increment-Counter "forecasts_requested"
Get-Counter "api_calls"
```

---

## 📚 **Learning Resources**

### **Redis:**
- **Interactive Tutorial**: Try Redis commands in your system
- **Documentation**: https://redis.io/docs
- **Use Cases**: Session management, caching, real-time analytics

### **MLflow:**
- **Web UI**: http://localhost:5000 (your running instance)
- **Documentation**: https://mlflow.org/docs
- **Use Cases**: ML experiment tracking, model versioning, deployment

---

## 🎯 **Quick Start Commands**

### **Redis:**
```powershell
# Load helper
. .\redis_helper.ps1

# Basic usage
Redis-Keys "*"
Redis-Set "test" "hello"
Redis-Get "test"
Redis-Stats
```

### **MLflow:**
```powershell
# Open in browser
start "http://localhost:5000"

# Generate new ML experiment
$auth = @{'Authorization' = 'Bearer YOUR_JWT_TOKEN'}
$body = '{"sku":"WIDGET-001","horizon_days":30}' 
Invoke-WebRequest -Uri "http://localhost:3001/api/forecast/predict" -Method POST -Headers $auth -Body $body -ContentType "application/json"
```

---

## 🚀 **Pro Tips**

1. **Redis Best Practices:**
   - Set TTL (expiration) on cached data
   - Use meaningful key naming conventions
   - Monitor memory usage regularly

2. **MLflow Best Practices:**
   - Review model performance weekly
   - Retrain models when accuracy drops
   - Compare different algorithms

3. **Integration Benefits:**
   - Cache ML predictions in Redis
   - Track cache hit rates in MLflow
   - Use both for real-time dashboards

Your inventory system uses both Redis and MLflow to provide **fast, intelligent, data-driven** inventory management! 🎉