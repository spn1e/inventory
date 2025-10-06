import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from train import train_prophet_model, evaluate_model, prepare_data
from inference import predict_demand
import joblib
import tempfile
import os

class TestTrainModule:
    """Test suite for ML training functionality"""
    
    @pytest.fixture
    def sample_sales_data(self):
        """Generate sample sales data for testing"""
        # Create 100 days of sales data with trend and seasonality
        dates = pd.date_range(start='2023-01-01', periods=100, freq='D')
        np.random.seed(42)
        
        # Generate synthetic data with trend and weekly seasonality
        trend = np.linspace(10, 20, len(dates))
        weekly_season = 5 * np.sin(2 * np.pi * np.arange(len(dates)) / 7)
        noise = np.random.normal(0, 2, len(dates))
        sales = np.maximum(0, trend + weekly_season + noise)
        
        df = pd.DataFrame({
            'ds': dates,
            'y': sales
        })
        return df
    
    @pytest.fixture
    def minimal_sales_data(self):
        """Generate minimal sales data for edge case testing"""
        dates = pd.date_range(start='2023-01-01', periods=5, freq='D')
        sales = [10, 12, 8, 15, 11]
        
        df = pd.DataFrame({
            'ds': dates,
            'y': sales
        })
        return df
    
    def test_prepare_data_basic(self, sample_sales_data):
        """Test basic data preparation functionality"""
        prepared_df = prepare_data(sample_sales_data)
        
        # Check that data is properly formatted
        assert isinstance(prepared_df, pd.DataFrame)
        assert 'ds' in prepared_df.columns
        assert 'y' in prepared_df.columns
        assert len(prepared_df) == len(sample_sales_data)
        
        # Check data types
        assert pd.api.types.is_datetime64_any_dtype(prepared_df['ds'])
        assert pd.api.types.is_numeric_dtype(prepared_df['y'])
        
        # Check for no negative values
        assert (prepared_df['y'] >= 0).all()
    
    def test_prepare_data_with_nulls(self):
        """Test data preparation with null values"""
        df = pd.DataFrame({
            'ds': pd.date_range('2023-01-01', periods=5, freq='D'),
            'y': [10, None, 15, None, 20]
        })
        
        prepared_df = prepare_data(df)
        
        # Nulls should be removed
        assert len(prepared_df) == 3
        assert not prepared_df['y'].isnull().any()
    
    def test_prepare_data_date_gaps(self):
        """Test data preparation with date gaps"""
        dates = [
            datetime(2023, 1, 1),
            datetime(2023, 1, 3),  # Missing 2023-01-02
            datetime(2023, 1, 5),  # Missing 2023-01-04
        ]
        df = pd.DataFrame({
            'ds': dates,
            'y': [10, 15, 20]
        })
        
        prepared_df = prepare_data(df)
        
        # Should fill in missing dates with zeros
        assert len(prepared_df) == 5  # All dates from 1/1 to 1/5
        assert (prepared_df['y'] >= 0).all()
    
    def test_train_prophet_model_success(self, sample_sales_data):
        """Test successful model training"""
        model, metrics = train_prophet_model(sample_sales_data, 'TEST-SKU')
        
        # Check that model is trained
        assert model is not None
        assert hasattr(model, 'predict')
        
        # Check metrics are returned
        assert isinstance(metrics, dict)
        assert 'mae' in metrics
        assert 'mape' in metrics
        assert 'rmse' in metrics
        assert 'r2' in metrics
        
        # Check metric values are reasonable
        assert metrics['mae'] >= 0
        assert metrics['mape'] >= 0
        assert metrics['rmse'] >= 0
        assert -1 <= metrics['r2'] <= 1
    
    def test_train_prophet_model_insufficient_data(self, minimal_sales_data):
        """Test model training with insufficient data"""
        with pytest.raises(ValueError, match="Insufficient data for training"):
            train_prophet_model(minimal_sales_data, 'TEST-SKU')
    
    def test_evaluate_model_metrics(self, sample_sales_data):
        """Test model evaluation metrics calculation"""
        model, _ = train_prophet_model(sample_sales_data, 'TEST-SKU')
        metrics = evaluate_model(model, sample_sales_data, 'TEST-SKU')
        
        # Check all expected metrics are present
        expected_metrics = [
            'mae', 'mse', 'rmse', 'mape', 'smape', 'r2',
            'direction_accuracy', 'bias', 'test_samples',
            'evaluation_date', 'accuracy_category'
        ]
        
        for metric in expected_metrics:
            assert metric in metrics
        
        # Check metric types and ranges
        assert isinstance(metrics['mae'], (int, float))
        assert isinstance(metrics['mape'], (int, float))
        assert isinstance(metrics['accuracy_category'], str)
        assert metrics['accuracy_category'] in ['Excellent', 'Good', 'Reasonable', 'Poor']
    
    def test_model_prediction_functionality(self, sample_sales_data):
        """Test that trained model can make predictions"""
        model, _ = train_prophet_model(sample_sales_data, 'TEST-SKU')
        
        # Test prediction for next 30 days
        future_df = model.make_future_dataframe(periods=30)
        forecast = model.predict(future_df)
        
        # Check forecast structure
        assert len(forecast) == len(sample_sales_data) + 30
        assert 'yhat' in forecast.columns
        assert 'yhat_lower' in forecast.columns
        assert 'yhat_upper' in forecast.columns
        
        # Check that predictions are reasonable (non-negative)
        future_predictions = forecast.tail(30)
        assert (future_predictions['yhat'] >= 0).all()
    
    def test_model_serialization(self, sample_sales_data):
        """Test that trained model can be saved and loaded"""
        model, metrics = train_prophet_model(sample_sales_data, 'TEST-SKU')
        
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp_file:
            try:
                # Save model
                joblib.dump(model, tmp_file.name)
                
                # Load model
                loaded_model = joblib.load(tmp_file.name)
                
                # Test that loaded model works
                future_df = loaded_model.make_future_dataframe(periods=10)
                forecast = loaded_model.predict(future_df)
                
                assert len(forecast) == len(sample_sales_data) + 10
                assert 'yhat' in forecast.columns
                
            finally:
                # Clean up
                if os.path.exists(tmp_file.name):
                    os.unlink(tmp_file.name)


class TestInferenceModule:
    """Test suite for ML inference functionality"""
    
    @pytest.fixture
    def trained_model_path(self, tmp_path):
        """Create a trained model for testing inference"""
        # Generate sample data
        dates = pd.date_range(start='2023-01-01', periods=50, freq='D')
        np.random.seed(42)
        trend = np.linspace(10, 15, len(dates))
        noise = np.random.normal(0, 1, len(dates))
        sales = np.maximum(0, trend + noise)
        
        df = pd.DataFrame({'ds': dates, 'y': sales})
        
        # Train model
        model, _ = train_prophet_model(df, 'TEST-SKU')
        
        # Save model
        model_path = tmp_path / "test_model.pkl"
        joblib.dump(model, model_path)
        
        return str(model_path)
    
    def test_predict_demand_success(self, trained_model_path):
        """Test successful demand prediction"""
        result = predict_demand(trained_model_path, horizon_days=30)
        
        # Check result structure
        assert isinstance(result, dict)
        assert 'predictions' in result
        assert 'summary' in result
        assert 'model_info' in result
        
        # Check predictions
        predictions = result['predictions']
        assert len(predictions) == 30
        assert all('date' in p for p in predictions)
        assert all('yhat' in p for p in predictions)
        assert all(p['yhat'] >= 0 for p in predictions)
        
        # Check summary
        summary = result['summary']
        assert 'horizon_days' in summary
        assert 'total_predicted_demand' in summary
        assert 'avg_daily_demand' in summary
        assert summary['horizon_days'] == 30
    
    def test_predict_demand_nonexistent_model(self):
        """Test prediction with non-existent model file"""
        with pytest.raises(FileNotFoundError):
            predict_demand('/nonexistent/path/model.pkl', horizon_days=30)
    
    def test_predict_demand_custom_start_date(self, trained_model_path):
        """Test prediction with custom start date"""
        start_date = datetime(2024, 1, 1)
        result = predict_demand(
            trained_model_path, 
            horizon_days=10, 
            start_date=start_date
        )
        
        predictions = result['predictions']
        assert len(predictions) == 10
        
        # Check that dates start from specified date
        first_prediction_date = datetime.strptime(predictions[0]['date'], '%Y-%m-%d')
        assert first_prediction_date == start_date
    
    def test_prediction_confidence_intervals(self, trained_model_path):
        """Test that prediction confidence intervals are reasonable"""
        result = predict_demand(trained_model_path, horizon_days=10)
        
        predictions = result['predictions']
        
        for prediction in predictions:
            yhat = prediction['yhat']
            yhat_lower = prediction.get('yhat_lower')
            yhat_upper = prediction.get('yhat_upper')
            
            # Check confidence interval ordering
            if yhat_lower is not None and yhat_upper is not None:
                assert yhat_lower <= yhat <= yhat_upper
                assert yhat_lower >= 0  # Non-negative predictions
    
    def test_prediction_summary_metrics(self, trained_model_path):
        """Test summary metrics calculation"""
        result = predict_demand(trained_model_path, horizon_days=20)
        
        summary = result['summary']
        predictions = result['predictions']
        
        # Verify calculated metrics
        expected_total = sum(p['yhat'] for p in predictions)
        expected_avg = expected_total / 20
        
        assert abs(summary['total_predicted_demand'] - expected_total) < 0.01
        assert abs(summary['avg_daily_demand'] - expected_avg) < 0.01
        
        # Check peak and low demand identification
        assert 'peak_demand' in summary
        assert 'low_demand' in summary
        assert 'date' in summary['peak_demand']
        assert 'value' in summary['peak_demand']


if __name__ == '__main__':
    # Run tests
    pytest.main([__file__, '-v'])