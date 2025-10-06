import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error
import logging
from typing import Tuple, Dict, Any
import warnings
from datetime import datetime, timedelta

# Suppress Prophet warnings
warnings.filterwarnings("ignore")
logging.getLogger('prophet').setLevel(logging.WARNING)
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare sales data for Prophet training
    
    Args:
        df: DataFrame with 'ds' (date) and 'y' (sales quantity) columns
        
    Returns:
        Cleaned and prepared DataFrame
    """
    # Ensure datetime format
    df['ds'] = pd.to_datetime(df['ds'])
    
    # Remove any null values
    df = df.dropna(subset=['y'])
    
    # Ensure non-negative values
    df['y'] = df['y'].clip(lower=0)
    
    # Sort by date
    df = df.sort_values('ds').reset_index(drop=True)
    
    # Fill in missing dates with zero sales
    date_range = pd.date_range(start=df['ds'].min(), end=df['ds'].max(), freq='D')
    full_df = pd.DataFrame({'ds': date_range})
    df = full_df.merge(df, on='ds', how='left').fillna(0)
    
    logger.info(f"Prepared {len(df)} data points from {df['ds'].min()} to {df['ds'].max()}")
    
    return df

def create_prophet_model(df: pd.DataFrame, sku: str) -> Prophet:
    """
    Create and configure Prophet model based on data characteristics
    
    Args:
        df: Prepared sales data
        sku: SKU identifier for logging
        
    Returns:
        Configured Prophet model
    """
    # Analyze data to determine model parameters
    data_span_days = (df['ds'].max() - df['ds'].min()).days
    avg_sales = df['y'].mean()
    sales_std = df['y'].std()
    
    logger.info(f"Data span: {data_span_days} days, avg sales: {avg_sales:.2f}, std: {sales_std:.2f}")
    
    # Configure model based on data characteristics
    model_params = {
        'daily_seasonality': False,
        'weekly_seasonality': True if data_span_days > 21 else False,
        'yearly_seasonality': True if data_span_days > 365 else False,
        'seasonality_mode': 'multiplicative' if avg_sales > 0 else 'additive',
        'changepoint_prior_scale': 0.05,  # Conservative for inventory data
        'seasonality_prior_scale': 10,
        'holidays_prior_scale': 10,
        'mcmc_samples': 0,  # Faster training
        'interval_width': 0.8,  # 80% confidence intervals
        'uncertainty_samples': 1000
    }
    
    # Add monthly seasonality for longer time series
    if data_span_days > 90:
        # We'll add this as a custom seasonality later, not as a model parameter
        pass
    
    model = Prophet(**model_params)
    
    # Add custom seasonalities based on data span
    if data_span_days > 30:
        model.add_seasonality(name='monthly', period=30.5, fourier_order=3)
    
    logger.info(f"Created Prophet model for SKU {sku} with parameters: {model_params}")
    
    return model

def train_prophet_model(df: pd.DataFrame, sku: str) -> Tuple[Prophet, Dict[str, Any]]:
    """
    Train Prophet model and evaluate performance
    
    Args:
        df: Sales data with 'ds' and 'y' columns
        sku: SKU identifier
        
    Returns:
        Tuple of (trained_model, metrics_dict)
    """
    try:
        logger.info(f"Training Prophet model for SKU: {sku}")
        
        # Prepare data
        prepared_df = prepare_data(df)
        
        if len(prepared_df) < 30:
            raise ValueError(f"Insufficient data for training: {len(prepared_df)} records")
        
        # Create and train model
        model = create_prophet_model(prepared_df, sku)
        
        # Fit the model
        logger.info("Fitting Prophet model...")
        model.fit(prepared_df)
        
        # Evaluate model performance
        metrics = evaluate_model(model, prepared_df, sku)
        
        logger.info(f"Model training completed for SKU {sku}")
        logger.info(f"Model metrics: {metrics}")
        
        return model, metrics
        
    except Exception as e:
        logger.error(f"Training failed for SKU {sku}: {e}")
        raise

def evaluate_model(model: Prophet, df: pd.DataFrame, sku: str) -> Dict[str, Any]:
    """
    Evaluate model performance using cross-validation and holdout testing
    
    Args:
        model: Trained Prophet model
        df: Training data
        sku: SKU identifier
        
    Returns:
        Dictionary containing evaluation metrics
    """
    try:
        logger.info(f"Evaluating model for SKU: {sku}")
        
        metrics = {}
        
        # Split data for holdout validation (80/20 split)
        split_point = int(len(df) * 0.8)
        train_df = df.iloc[:split_point].copy()
        test_df = df.iloc[split_point:].copy()
        
        if len(test_df) < 7:  # Need at least a week of test data
            logger.warning(f"Insufficient test data for holdout evaluation: {len(test_df)} records")
            
            # Use in-sample evaluation instead
            forecast = model.predict(df)
            y_true = df['y'].values
            y_pred = forecast['yhat'].values
            
        else:
            # Retrain model on training subset
            temp_model = create_prophet_model(train_df, sku)
            temp_model.fit(train_df)
            
            # Predict on test set
            forecast = temp_model.predict(test_df[['ds']])
            y_true = test_df['y'].values
            y_pred = forecast['yhat'].values
        
        # Ensure non-negative predictions
        y_pred = np.maximum(y_pred, 0)
        
        # Calculate metrics
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        
        # Mean Absolute Percentage Error (MAPE)
        # Handle division by zero
        mape_mask = y_true != 0
        if np.any(mape_mask):
            mape = np.mean(np.abs((y_true[mape_mask] - y_pred[mape_mask]) / y_true[mape_mask])) * 100
        else:
            mape = 0
        
        # Symmetric MAPE (more robust)
        smape = np.mean(2 * np.abs(y_true - y_pred) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100
        
        # R-squared
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r2 = 1 - (ss_res / (ss_tot + 1e-8))
        
        # Directional accuracy (for trend prediction)
        if len(y_true) > 1:
            true_direction = np.diff(y_true)
            pred_direction = np.diff(y_pred)
            direction_accuracy = np.mean(np.sign(true_direction) == np.sign(pred_direction)) * 100
        else:
            direction_accuracy = 0
        
        # Bias (forecast bias)
        bias = np.mean(y_pred - y_true)
        
        metrics = {
            'mae': round(float(mae), 4),
            'mse': round(float(mse), 4),
            'rmse': round(float(rmse), 4),
            'mape': round(float(mape), 4),
            'smape': round(float(smape), 4),
            'r2': round(float(r2), 4),
            'direction_accuracy': round(float(direction_accuracy), 4),
            'bias': round(float(bias), 4),
            'test_samples': len(y_true),
            'evaluation_date': datetime.now().isoformat(),
            'data_span_days': (df['ds'].max() - df['ds'].min()).days,
            'avg_actual': round(float(np.mean(y_true)), 4),
            'avg_predicted': round(float(np.mean(y_pred)), 4)
        }
        
        # Calculate forecast accuracy category
        if mape <= 10:
            accuracy_category = 'Excellent'
        elif mape <= 20:
            accuracy_category = 'Good'
        elif mape <= 50:
            accuracy_category = 'Reasonable'
        else:
            accuracy_category = 'Poor'
        
        metrics['accuracy_category'] = accuracy_category
        
        logger.info(f"Model evaluation completed for SKU {sku}: MAPE={mape:.2f}%, Accuracy={accuracy_category}")
        
        return metrics
        
    except Exception as e:
        logger.error(f"Model evaluation failed for SKU {sku}: {e}")
        return {
            'error': str(e),
            'evaluation_date': datetime.now().isoformat()
        }

def cross_validate_model(model: Prophet, df: pd.DataFrame, sku: str) -> Dict[str, Any]:
    """
    Perform time series cross-validation using Prophet's built-in CV
    
    Args:
        model: Trained Prophet model
        df: Training data
        sku: SKU identifier
        
    Returns:
        Cross-validation metrics
    """
    try:
        from prophet.diagnostics import cross_validation, performance_metrics
        
        logger.info(f"Performing cross-validation for SKU: {sku}")
        
        # Determine CV parameters based on data length
        data_span = (df['ds'].max() - df['ds'].min()).days
        
        if data_span < 90:
            # For shorter series, use smaller horizons
            horizon = '14 days'
            initial = '30 days'
            period = '7 days'
        elif data_span < 365:
            horizon = '30 days'
            initial = '90 days'
            period = '14 days'
        else:
            horizon = '60 days'
            initial = '180 days'
            period = '30 days'
        
        # Perform cross-validation
        cv_results = cross_validation(
            model, 
            horizon=horizon,
            initial=initial,
            period=period
        )
        
        # Calculate performance metrics
        cv_metrics = performance_metrics(cv_results)
        
        # Aggregate metrics
        cv_summary = {
            'cv_mae': float(cv_metrics['mae'].mean()),
            'cv_mape': float(cv_metrics['mape'].mean()),
            'cv_rmse': float(cv_metrics['rmse'].mean()),
            'cv_coverage': float(cv_metrics['coverage'].mean()) if 'coverage' in cv_metrics else None,
            'cv_horizon': horizon,
            'cv_folds': len(cv_metrics),
            'cv_date': datetime.now().isoformat()
        }
        
        logger.info(f"Cross-validation completed for SKU {sku}: CV_MAPE={cv_summary['cv_mape']:.4f}")
        
        return cv_summary
        
    except ImportError:
        logger.warning("Prophet diagnostics not available, skipping cross-validation")
        return {}
    except Exception as e:
        logger.warning(f"Cross-validation failed for SKU {sku}: {e}")
        return {'cv_error': str(e)}

def retrain_if_needed(model: Prophet, new_data: pd.DataFrame, sku: str, threshold_days: int = 30) -> Tuple[bool, Prophet, Dict]:
    """
    Determine if model needs retraining based on new data
    
    Args:
        model: Existing model
        new_data: New sales data
        sku: SKU identifier
        threshold_days: Days of new data that trigger retraining
        
    Returns:
        Tuple of (needs_retrain, updated_model, metrics)
    """
    try:
        # Check if we have significant new data
        if len(new_data) < threshold_days:
            return False, model, {}
        
        logger.info(f"Checking if retraining needed for SKU {sku}")
        
        # Simple rule: retrain if we have 30+ days of new data
        # In production, you might want more sophisticated drift detection
        
        logger.info(f"Retraining model for SKU {sku} due to new data")
        retrained_model, metrics = train_prophet_model(new_data, sku)
        
        return True, retrained_model, metrics
        
    except Exception as e:
        logger.error(f"Retraining check failed for SKU {sku}: {e}")
        return False, model, {}

if __name__ == "__main__":
    # Test training with sample data
    import sys
    
    # Create sample data for testing
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
    np.random.seed(42)
    
    # Generate synthetic sales data with trend and seasonality
    trend = np.linspace(10, 15, len(dates))
    seasonal = 3 * np.sin(2 * np.pi * np.arange(len(dates)) / 365.25)
    noise = np.random.normal(0, 2, len(dates))
    sales = np.maximum(0, trend + seasonal + noise)
    
    test_df = pd.DataFrame({
        'ds': dates,
        'y': sales
    })
    
    print("Testing Prophet training with synthetic data...")
    
    try:
        model, metrics = train_prophet_model(test_df, 'TEST-SKU')
        print("Training successful!")
        print(f"Metrics: {metrics}")
        
        # Test prediction
        future = model.make_future_dataframe(periods=30)
        forecast = model.predict(future)
        print(f"Generated forecast for next 30 days")
        print(f"Last forecast value: {forecast['yhat'].iloc[-1]:.2f}")
        
    except Exception as e:
        print(f"Training test failed: {e}")
        sys.exit(1)