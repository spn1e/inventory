import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import joblib
import os

logger = logging.getLogger(__name__)

def predict_demand(
    model_path: str,
    horizon_days: int = 30,
    start_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Generate demand predictions using a trained Prophet model
    
    Args:
        model_path: Path to the saved model file
        horizon_days: Number of days to forecast
        start_date: Start date for predictions (default: tomorrow)
        
    Returns:
        Dictionary containing forecast data and metadata
    """
    try:
        logger.info(f"Loading model from {model_path}")
        
        # Load the trained model
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        model = joblib.load(model_path)
        
        # Set start date (default to tomorrow)
        if start_date is None:
            start_date = datetime.now().date() + timedelta(days=1)
        
        # Generate future dates
        future_dates = pd.date_range(
            start=start_date,
            periods=horizon_days,
            freq='D'
        )
        
        # Create future dataframe for Prophet
        future_df = pd.DataFrame({'ds': future_dates})
        
        logger.info(f"Generating predictions for {horizon_days} days starting from {start_date}")
        
        # Make predictions
        forecast = model.predict(future_df)
        
        # Process predictions
        predictions = []
        for i, row in forecast.iterrows():
            pred = {
                'date': row['ds'].strftime('%Y-%m-%d'),
                'yhat': max(0, float(row['yhat'])),  # Ensure non-negative
                'yhat_lower': max(0, float(row['yhat_lower'])) if pd.notna(row['yhat_lower']) else None,
                'yhat_upper': max(0, float(row['yhat_upper'])) if pd.notna(row['yhat_upper']) else None
            }
            
            # Add trend and seasonal components if available
            if 'trend' in forecast.columns:
                pred['trend'] = float(row['trend'])
            
            if 'weekly' in forecast.columns:
                pred['weekly_seasonal'] = float(row['weekly'])
            
            if 'yearly' in forecast.columns:
                pred['yearly_seasonal'] = float(row['yearly'])
                
            predictions.append(pred)
        
        # Calculate summary statistics
        total_predicted = sum(p['yhat'] for p in predictions)
        avg_daily = total_predicted / horizon_days
        
        # Identify peak and low demand periods
        values = [p['yhat'] for p in predictions]
        max_demand_idx = np.argmax(values)
        min_demand_idx = np.argmin(values)
        
        peak_demand = {
            'date': predictions[max_demand_idx]['date'],
            'value': predictions[max_demand_idx]['yhat']
        }
        
        low_demand = {
            'date': predictions[min_demand_idx]['date'],
            'value': predictions[min_demand_idx]['yhat']
        }
        
        result = {
            'predictions': predictions,
            'summary': {
                'horizon_days': horizon_days,
                'total_predicted_demand': round(total_predicted, 2),
                'avg_daily_demand': round(avg_daily, 2),
                'peak_demand': peak_demand,
                'low_demand': low_demand,
                'forecast_date': datetime.now().isoformat()
            },
            'model_info': {
                'model_path': model_path,
                'model_type': 'prophet'
            }
        }
        
        logger.info(f"Prediction completed: {horizon_days} days, total demand: {total_predicted:.2f}")
        
        return result
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise

def batch_predict(
    model_paths: List[str],
    horizon_days: int = 30,
    start_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Generate predictions for multiple models in batch
    
    Args:
        model_paths: List of model file paths
        horizon_days: Number of days to forecast
        start_date: Start date for predictions
        
    Returns:
        Dictionary containing all predictions
    """
    try:
        logger.info(f"Starting batch prediction for {len(model_paths)} models")
        
        results = {}
        errors = {}
        
        for model_path in model_paths:
            try:
                # Extract SKU from model path
                sku = os.path.basename(model_path).replace('prophet_', '').replace('.pkl', '')
                
                # Generate prediction
                prediction = predict_demand(model_path, horizon_days, start_date)
                results[sku] = prediction
                
            except Exception as e:
                logger.error(f"Batch prediction failed for {model_path}: {e}")
                errors[model_path] = str(e)
        
        summary = {
            'total_models': len(model_paths),
            'successful_predictions': len(results),
            'failed_predictions': len(errors),
            'success_rate': len(results) / len(model_paths) * 100 if model_paths else 0,
            'batch_date': datetime.now().isoformat()
        }
        
        return {
            'success': True,
            'results': results,
            'errors': errors,
            'summary': summary
        }
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return {
            'success': False,
            'error': str(e),
            'results': {},
            'errors': {}
        }

def analyze_forecast_accuracy(
    actual_data: pd.DataFrame,
    predicted_data: List[Dict],
    sku: str
) -> Dict[str, Any]:
    """
    Compare actual vs predicted values to assess forecast accuracy
    
    Args:
        actual_data: DataFrame with actual sales data (columns: date, actual)
        predicted_data: List of prediction dictionaries
        sku: SKU identifier
        
    Returns:
        Accuracy analysis results
    """
    try:
        logger.info(f"Analyzing forecast accuracy for SKU: {sku}")
        
        # Convert predicted data to DataFrame
        pred_df = pd.DataFrame(predicted_data)
        pred_df['date'] = pd.to_datetime(pred_df['date'])
        pred_df = pred_df.set_index('date')
        
        # Prepare actual data
        actual_df = actual_data.copy()
        actual_df['date'] = pd.to_datetime(actual_df['date'])
        actual_df = actual_df.set_index('date')
        
        # Merge actual and predicted data
        comparison_df = actual_df.join(pred_df[['yhat']], how='inner')
        comparison_df = comparison_df.dropna()
        
        if comparison_df.empty:
            raise ValueError("No overlapping dates between actual and predicted data")
        
        # Calculate accuracy metrics
        actual_values = comparison_df['actual'].values
        predicted_values = comparison_df['yhat'].values
        
        # Basic metrics
        mae = np.mean(np.abs(actual_values - predicted_values))
        mse = np.mean((actual_values - predicted_values) ** 2)
        rmse = np.sqrt(mse)
        
        # Percentage errors
        mape = np.mean(np.abs((actual_values - predicted_values) / (actual_values + 1e-8))) * 100
        smape = np.mean(2 * np.abs(actual_values - predicted_values) / 
                       (np.abs(actual_values) + np.abs(predicted_values) + 1e-8)) * 100
        
        # Bias metrics
        bias = np.mean(predicted_values - actual_values)
        bias_percent = bias / (np.mean(actual_values) + 1e-8) * 100
        
        # Correlation
        correlation = np.corrcoef(actual_values, predicted_values)[0, 1] if len(actual_values) > 1 else 0
        
        # Direction accuracy (trend prediction)
        if len(actual_values) > 1:
            actual_trend = np.diff(actual_values)
            pred_trend = np.diff(predicted_values)
            direction_accuracy = np.mean(np.sign(actual_trend) == np.sign(pred_trend)) * 100
        else:
            direction_accuracy = 0
        
        # Forecast quality assessment
        if mape <= 10:
            quality = "Excellent"
        elif mape <= 20:
            quality = "Good"
        elif mape <= 50:
            quality = "Fair"
        else:
            quality = "Poor"
        
        results = {
            'sku': sku,
            'evaluation_period': {
                'start_date': comparison_df.index.min().strftime('%Y-%m-%d'),
                'end_date': comparison_df.index.max().strftime('%Y-%m-%d'),
                'days_evaluated': len(comparison_df)
            },
            'metrics': {
                'mae': round(float(mae), 4),
                'mse': round(float(mse), 4),
                'rmse': round(float(rmse), 4),
                'mape': round(float(mape), 4),
                'smape': round(float(smape), 4),
                'bias': round(float(bias), 4),
                'bias_percent': round(float(bias_percent), 4),
                'correlation': round(float(correlation), 4),
                'direction_accuracy': round(float(direction_accuracy), 4)
            },
            'summary': {
                'forecast_quality': quality,
                'avg_actual': round(float(np.mean(actual_values)), 2),
                'avg_predicted': round(float(np.mean(predicted_values)), 2),
                'total_actual': round(float(np.sum(actual_values)), 2),
                'total_predicted': round(float(np.sum(predicted_values)), 2)
            },
            'analysis_date': datetime.now().isoformat()
        }
        
        logger.info(f"Accuracy analysis completed for SKU {sku}: MAPE={mape:.2f}%, Quality={quality}")
        
        return results
        
    except Exception as e:
        logger.error(f"Accuracy analysis failed for SKU {sku}: {e}")
        raise

def get_prediction_intervals(
    predictions: List[Dict],
    confidence_level: float = 0.8
) -> Dict[str, Any]:
    """
    Calculate prediction intervals and confidence bands
    
    Args:
        predictions: List of prediction dictionaries
        confidence_level: Confidence level for intervals (default 0.8 = 80%)
        
    Returns:
        Interval analysis results
    """
    try:
        if not predictions:
            raise ValueError("No predictions provided")
        
        # Extract values
        point_forecasts = [p['yhat'] for p in predictions]
        lower_bounds = [p.get('yhat_lower', p['yhat']) for p in predictions]
        upper_bounds = [p.get('yhat_upper', p['yhat']) for p in predictions]
        
        # Calculate interval widths
        interval_widths = [upper - lower for upper, lower in zip(upper_bounds, lower_bounds)]
        
        # Statistics
        avg_interval_width = np.mean(interval_widths)
        max_interval_width = np.max(interval_widths)
        min_interval_width = np.min(interval_widths)
        
        # Uncertainty trend (increasing/decreasing interval widths over time)
        if len(interval_widths) > 1:
            uncertainty_trend = np.polyfit(range(len(interval_widths)), interval_widths, 1)[0]
        else:
            uncertainty_trend = 0
        
        results = {
            'confidence_level': confidence_level,
            'interval_statistics': {
                'avg_width': round(avg_interval_width, 2),
                'max_width': round(max_interval_width, 2),
                'min_width': round(min_interval_width, 2),
                'width_std': round(float(np.std(interval_widths)), 2)
            },
            'uncertainty_analysis': {
                'trend': 'increasing' if uncertainty_trend > 0 else 'decreasing' if uncertainty_trend < 0 else 'stable',
                'trend_slope': round(float(uncertainty_trend), 4)
            },
            'forecast_range': {
                'min_predicted': round(min(point_forecasts), 2),
                'max_predicted': round(max(point_forecasts), 2),
                'range_span': round(max(point_forecasts) - min(point_forecasts), 2)
            }
        }
        
        return results
        
    except Exception as e:
        logger.error(f"Interval analysis error: {e}")
        raise

if __name__ == "__main__":
    # Test inference functionality
    import sys
    from train import train_prophet_model
    
    # Create sample data for testing
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
    np.random.seed(42)
    
    # Generate synthetic sales data
    trend = np.linspace(10, 15, len(dates))
    seasonal = 3 * np.sin(2 * np.pi * np.arange(len(dates)) / 365.25)
    noise = np.random.normal(0, 2, len(dates))
    sales = np.maximum(0, trend + seasonal + noise)
    
    test_df = pd.DataFrame({
        'ds': dates,
        'y': sales
    })
    
    print("Testing inference functionality...")
    
    try:
        # Train a model
        model, metrics = train_prophet_model(test_df, 'TEST-SKU')
        
        # Save model temporarily
        test_model_path = '/tmp/test_prophet_model.pkl'
        joblib.dump(model, test_model_path)
        
        # Test prediction
        result = predict_demand(test_model_path, horizon_days=30)
        
        print("Inference test successful!")
        print(f"Generated {len(result['predictions'])} predictions")
        print(f"Total predicted demand: {result['summary']['total_predicted_demand']}")
        print(f"Average daily demand: {result['summary']['avg_daily_demand']}")
        
        # Clean up
        if os.path.exists(test_model_path):
            os.remove(test_model_path)
            
    except Exception as e:
        print(f"Inference test failed: {e}")
        sys.exit(1)