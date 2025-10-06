from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
import os
import logging
from datetime import datetime, timedelta
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
import mlflow
import mlflow.sklearn
from train import train_prophet_model, evaluate_model
from inference import predict_demand
import joblib
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Smart Inventory ML Service",
    description="Machine Learning microservice for demand forecasting and inventory optimization",
    version="1.0.0"
)

# MLflow configuration
mlflow.set_tracking_uri(os.getenv('MLFLOW_TRACKING_URI', 'http://localhost:5000'))
mlflow.set_experiment("inventory_forecasting")

# Database configuration
# First try to use DATABASE_URL if available, otherwise use individual parameters
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Log sanitized connection string (hide password)
    sanitized_url = database_url.replace(database_url.split('@')[0].split(':')[-1], '****') if '@' in database_url else database_url
    logger.info(f"Using database connection from DATABASE_URL: {sanitized_url}")
    
    # Parse DATABASE_URL to extract components for DB_CONFIG
    try:
        from urllib.parse import urlparse
        parsed = urlparse(database_url)
        DB_CONFIG = {
            'host': parsed.hostname,
            'database': parsed.path[1:],
            'user': parsed.username,
            'password': parsed.password,
            'port': parsed.port or '5432'
        }
    except Exception as e:
        logger.error(f"Failed to parse DATABASE_URL: {e}")
        # Fall back to individual parameters if parsing fails
        DB_CONFIG = {
            'host': os.getenv('POSTGRES_HOST', 'postgres'),
            'database': os.getenv('POSTGRES_DB', 'inventory_db'),
            'user': os.getenv('POSTGRES_USER', 'inventory_user'),
            'password': os.getenv('POSTGRES_PASS', 'inventory_pass'),
            'port': os.getenv('POSTGRES_PORT', '5432')
        }
else:
    # Use individual parameters
    DB_CONFIG = {
        'host': os.getenv('PGHOST', os.getenv('POSTGRES_HOST', 'postgres')),
        'database': os.getenv('PGDATABASE', os.getenv('POSTGRES_DB', 'inventory_db')),
        'user': os.getenv('PGUSER', os.getenv('POSTGRES_USER', 'inventory_user')),
        'password': os.getenv('PGPASSWORD', os.getenv('POSTGRES_PASS', 'inventory_pass')),
        'port': os.getenv('PGPORT', os.getenv('POSTGRES_PORT', '5432'))
    }
    logger.info(f"Using database connection: {DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")

# Pydantic models
class PredictRequest(BaseModel):
    sku: str
    horizon_days: int = 30

class TrainRequest(BaseModel):
    sku: str
    retrain: bool = False

class PredictResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    mlflow_uri: str

# Database connection helper
def get_db_connection():
    """Get database connection with proper error handling"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Utility functions
def get_sales_data(sku: str, days: int = 365) -> pd.DataFrame:
    """Fetch sales data for a specific SKU"""
    conn = get_db_connection()
    try:
        query = """
        SELECT date, SUM(qty) as y
        FROM sales
        WHERE sku = %s
        GROUP BY date
        ORDER BY date
        """
        
        df = pd.read_sql(query, conn, params=(sku,))
        if df.empty:
            raise ValueError(f"No sales data found for SKU: {sku}")
        
        # Rename columns for Prophet
        df['ds'] = pd.to_datetime(df['date'])
        df = df[['ds', 'y']].sort_values('ds')
        
        logger.info(f"Loaded {len(df)} sales records for SKU {sku}")
        return df
        
    except Exception as e:
        logger.error(f"Error fetching sales data for SKU {sku}: {e}")
        raise
    finally:
        conn.close()

def model_exists(sku: str) -> bool:
    """Check if a trained model exists for the SKU"""
    model_path = f"models/prophet_{sku}.pkl"
    return os.path.exists(model_path)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        mlflow_uri=os.getenv('MLFLOW_TRACKING_URI', 'http://localhost:5000')
    )

@app.post("/predict", response_model=PredictResponse)
async def predict_endpoint(request: PredictRequest):
    """Generate demand forecast for a specific SKU"""
    try:
        sku = request.sku
        horizon_days = request.horizon_days
        
        logger.info(f"Prediction request for SKU: {sku}, horizon: {horizon_days} days")
        
        # Check if model exists, if not train it
        if not model_exists(sku):
            logger.info(f"No model found for SKU {sku}, training new model")
            try:
                await train_model_async(sku)
            except Exception as e:
                logger.error(f"Failed to train model for SKU {sku}: {e}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Could not train model for SKU {sku}: {str(e)}"
                )
        
        # Load model and make predictions
        try:
            model_path = f"models/prophet_{sku}.pkl"
            model = joblib.load(model_path)
            
            # Generate future dates
            future_dates = pd.date_range(
                start=datetime.now().date() + timedelta(days=1),
                periods=horizon_days,
                freq='D'
            )
            
            future_df = pd.DataFrame({'ds': future_dates})
            forecast = model.predict(future_df)
            
            # Prepare response data
            forecast_data = []
            for i, row in forecast.iterrows():
                forecast_data.append({
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'yhat': max(0, round(row['yhat'], 2)),  # Ensure non-negative
                    'yhat_lower': max(0, round(row['yhat_lower'], 2)) if pd.notna(row['yhat_lower']) else 0,
                    'yhat_upper': max(0, round(row['yhat_upper'], 2)) if pd.notna(row['yhat_upper']) else 0
                })
            
            # Load model metrics if available
            metrics_path = f"models/prophet_{sku}_metrics.pkl"
            metrics = {}
            if os.path.exists(metrics_path):
                metrics = joblib.load(metrics_path)
            
            return PredictResponse(
                success=True,
                data={
                    'sku': sku,
                    'horizon_days': horizon_days,
                    'forecast': forecast_data,
                    'model_name': 'prophet',
                    'metrics': metrics,
                    'generated_at': datetime.now().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Prediction error for SKU {sku}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Prediction failed for SKU {sku}: {str(e)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in predict endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/train")
async def train_endpoint(background_tasks: BackgroundTasks, request: TrainRequest):
    """Train or retrain model for a specific SKU"""
    try:
        sku = request.sku
        retrain = request.retrain
        
        logger.info(f"Training request for SKU: {sku}, retrain: {retrain}")
        
        # Check if model exists and retrain is not forced
        if model_exists(sku) and not retrain:
            return {
                "success": True,
                "message": f"Model for SKU {sku} already exists. Use retrain=true to force retrain.",
                "model_path": f"models/prophet_{sku}.pkl"
            }
        
        # Add training to background tasks
        background_tasks.add_task(train_model_async, sku)
        
        return {
            "success": True,
            "message": f"Training started for SKU {sku}",
            "status": "training_in_progress"
        }
        
    except Exception as e:
        logger.error(f"Training request error: {e}")
        raise HTTPException(status_code=500, detail=f"Training request failed: {str(e)}")

async def train_model_async(sku: str):
    """Asynchronously train model for a SKU"""
    try:
        logger.info(f"Starting training for SKU: {sku}")
        
        # Fetch sales data
        sales_data = get_sales_data(sku)
        
        # Check if we have enough data
        if len(sales_data) < 30:
            raise ValueError(f"Insufficient data for training. Need at least 30 records, got {len(sales_data)}")
        
        # Train model
        model, metrics = train_prophet_model(sales_data, sku)
        
        # Save model and metrics
        os.makedirs('models', exist_ok=True)
        model_path = f"models/prophet_{sku}.pkl"
        metrics_path = f"models/prophet_{sku}_metrics.pkl"
        
        joblib.dump(model, model_path)
        joblib.dump(metrics, metrics_path)
        
        # Log to MLflow
        with mlflow.start_run():
            mlflow.log_param("sku", sku)
            mlflow.log_param("model_type", "prophet")
            mlflow.log_param("data_points", len(sales_data))
            
            if metrics:
                for key, value in metrics.items():
                    if isinstance(value, (int, float)):
                        mlflow.log_metric(key, value)
            
            mlflow.sklearn.log_model(model, f"prophet_model_{sku}")
        
        logger.info(f"Training completed for SKU: {sku}")
        logger.info(f"Model metrics: {metrics}")
        
    except Exception as e:
        logger.error(f"Training failed for SKU {sku}: {e}")
        raise

@app.get("/models")
async def list_models():
    """List all available trained models"""
    try:
        models_dir = "models"
        if not os.path.exists(models_dir):
            return {"success": True, "models": []}
        
        model_files = [f for f in os.listdir(models_dir) if f.endswith('.pkl') and 'prophet_' in f and 'metrics' not in f]
        models = []
        
        for model_file in model_files:
            sku = model_file.replace('prophet_', '').replace('.pkl', '')
            model_path = os.path.join(models_dir, model_file)
            metrics_path = os.path.join(models_dir, f'prophet_{sku}_metrics.pkl')
            
            model_info = {
                'sku': sku,
                'model_path': model_path,
                'created_at': datetime.fromtimestamp(os.path.getctime(model_path)).isoformat(),
                'size_kb': round(os.path.getsize(model_path) / 1024, 2)
            }
            
            # Load metrics if available
            if os.path.exists(metrics_path):
                try:
                    metrics = joblib.load(metrics_path)
                    model_info['metrics'] = metrics
                except:
                    model_info['metrics'] = {}
            
            models.append(model_info)
        
        return {
            "success": True,
            "models": sorted(models, key=lambda x: x['created_at'], reverse=True),
            "count": len(models)
        }
        
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list models")

@app.delete("/models/{sku}")
async def delete_model(sku: str):
    """Delete model for a specific SKU"""
    try:
        model_path = f"models/prophet_{sku}.pkl"
        metrics_path = f"models/prophet_{sku}_metrics.pkl"
        
        deleted_files = []
        
        if os.path.exists(model_path):
            os.remove(model_path)
            deleted_files.append(model_path)
        
        if os.path.exists(metrics_path):
            os.remove(metrics_path)
            deleted_files.append(metrics_path)
        
        if not deleted_files:
            raise HTTPException(status_code=404, detail=f"No model found for SKU: {sku}")
        
        return {
            "success": True,
            "message": f"Model deleted for SKU: {sku}",
            "deleted_files": deleted_files
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model for SKU {sku}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete model")

@app.get("/skus")
async def list_available_skus():
    """Get list of SKUs with sales data available for training"""
    conn = get_db_connection()
    try:
        query = """
        SELECT 
            s.sku,
            i.name,
            COUNT(*) as sales_records,
            MIN(s.date) as first_sale,
            MAX(s.date) as last_sale,
            SUM(s.qty) as total_sold
        FROM sales s
        JOIN inventory_items i ON s.sku = i.sku
        GROUP BY s.sku, i.name
        HAVING COUNT(*) >= 10
        ORDER BY COUNT(*) DESC
        """
        
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            skus = cursor.fetchall()
        
        return {
            "success": True,
            "skus": [dict(sku) for sku in skus],
            "count": len(skus)
        }
        
    except Exception as e:
        logger.error(f"Error listing SKUs: {e}")
        raise HTTPException(status_code=500, detail="Failed to list SKUs")
    finally:
        conn.close()

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return {"success": False, "error": "Internal server error", "detail": str(exc)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)