import express from 'express';
import axios from 'axios';
import Joi from 'joi';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Validation schemas
const predictSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  horizon_days: Joi.number().integer().min(1).max(365).required()
});

/**
 * @route GET /api/forecast/:sku/latest
 * @desc Get latest forecast for a specific SKU
 * @access Public
 */
router.get('/:sku/latest', async (req, res) => {
  try {
    const { sku } = req.params;
    const { days = 30 } = req.query;

    // Check if SKU exists
    const item = await req.db('inventory_items')
      .where('sku', sku)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    // Get latest forecasts for the SKU
    const forecasts = await req.db('forecasts')
      .where('sku', sku)
      .where('date', '>=', req.db.raw('CURRENT_DATE'))
      .orderBy('date')
      .limit(parseInt(days));

    if (forecasts.length === 0) {
      return res.json({
        success: true,
        message: 'No forecasts available for this SKU',
        data: {
          sku,
          forecasts: [],
          needs_training: true
        }
      });
    }

    // Get historical sales for comparison
    const historicalSales = await req.db('sales')
      .where('sku', sku)
      .where('date', '>=', req.db.raw('CURRENT_DATE - INTERVAL \'90 days\''))
      .select('date', req.db.raw('SUM(qty) as total_qty'))
      .groupBy('date')
      .orderBy('date');

    res.json({
      success: true,
      data: {
        sku,
        forecasts: forecasts.map(f => ({
          date: f.date,
          forecast_qty: parseFloat(f.forecast_qty),
          confidence_lower: f.confidence_lower ? parseFloat(f.confidence_lower) : null,
          confidence_upper: f.confidence_upper ? parseFloat(f.confidence_upper) : null,
          model_name: f.model_name,
          created_at: f.created_at
        })),
        historical_sales: historicalSales.map(s => ({
          date: s.date,
          actual_qty: parseInt(s.total_qty)
        })),
        last_updated: forecasts[0]?.created_at
      }
    });

  } catch (error) {
    req.logger.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

/**
 * @route POST /api/forecast/predict
 * @desc Generate new forecast for a specific SKU
 * @access Private
 */
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    const { error, value } = predictSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sku, horizon_days } = value;

    // Check if SKU exists
    const item = await req.db('inventory_items')
      .where('sku', sku)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    // Check if there's enough historical data
    const salesCount = await req.db('sales')
      .where('sku', sku)
      .count('* as count')
      .first();

    if (parseInt(salesCount.count) < 10) {
      return res.status(400).json({ 
        error: 'Insufficient historical data for forecasting',
        message: 'At least 10 sales records are required for forecasting'
      });
    }

    // Call ML service to generate forecast
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml_service:8000';
    
    try {
      const mlResponse = await axios.post(`${mlServiceUrl}/predict`, {
        sku,
        horizon_days
      }, {
        timeout: 30000 // 30 second timeout
      });

      if (!mlResponse.data.success) {
        throw new Error(mlResponse.data.error || 'ML service prediction failed');
      }

      const forecastData = mlResponse.data.data;

      // Store forecasts in database
      const forecastRecords = forecastData.forecast.map(point => ({
        sku,
        date: point.date,
        forecast_qty: point.yhat,
        confidence_lower: point.yhat_lower,
        confidence_upper: point.yhat_upper,
        model_name: forecastData.model_name || 'prophet',
        model_metrics: JSON.stringify(forecastData.metrics || {})
      }));

      // Delete existing future forecasts for this SKU
      await req.db('forecasts')
        .where('sku', sku)
        .where('date', '>=', req.db.raw('CURRENT_DATE'))
        .delete();

      // Insert new forecasts
      const insertedForecasts = await req.db('forecasts')
        .insert(forecastRecords)
        .returning('*');

      // Create alert for forecast completion
      await req.db('alerts').insert({
        sku,
        type: 'forecast_complete',
        title: 'Forecast Updated',
        message: `New ${horizon_days}-day forecast generated for ${sku}`,
        severity: 'info',
        metadata: JSON.stringify({
          horizon_days,
          forecast_points: insertedForecasts.length,
          model_metrics: forecastData.metrics
        })
      });

      // Emit socket event
      req.io.emit('forecast_ready', {
        sku,
        horizon_days,
        forecast_count: insertedForecasts.length,
        metrics: forecastData.metrics
      });

      res.json({
        success: true,
        message: 'Forecast generated successfully',
        data: {
          sku,
          horizon_days,
          forecast: insertedForecasts.map(f => ({
            date: f.date,
            forecast_qty: parseFloat(f.forecast_qty),
            confidence_lower: f.confidence_lower ? parseFloat(f.confidence_lower) : null,
            confidence_upper: f.confidence_upper ? parseFloat(f.confidence_upper) : null
          })),
          model_metrics: forecastData.metrics,
          model_name: forecastData.model_name
        }
      });

    } catch (mlError) {
      req.logger.error('ML service error:', mlError);
      
      if (mlError.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'ML service unavailable',
          message: 'The forecasting service is currently unavailable'
        });
      }
      
      return res.status(500).json({ 
        error: 'Forecast generation failed',
        message: mlError.message
      });
    }

  } catch (error) {
    req.logger.error('Error generating forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

/**
 * @route GET /api/forecast/models/metrics
 * @desc Get model performance metrics for all SKUs
 * @access Private
 */
router.get('/models/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = await req.db('forecasts')
      .select('sku', 'model_name')
      .select(req.db.raw('model_metrics->\'mae\' as mae'))
      .select(req.db.raw('model_metrics->\'mape\' as mape'))
      .select(req.db.raw('model_metrics->\'rmse\' as rmse'))
      .select('created_at')
      .whereNotNull('model_metrics')
      .orderBy('created_at', 'desc')
      .groupBy('sku', 'model_name', 'model_metrics', 'created_at');

    const processedMetrics = metrics.map(m => ({
      sku: m.sku,
      model_name: m.model_name,
      mae: m.mae ? parseFloat(m.mae) : null,
      mape: m.mape ? parseFloat(m.mape) : null,
      rmse: m.rmse ? parseFloat(m.rmse) : null,
      last_updated: m.created_at
    }));

    res.json({
      success: true,
      data: processedMetrics
    });

  } catch (error) {
    req.logger.error('Error fetching model metrics:', error);
    res.status(500).json({ error: 'Failed to fetch model metrics' });
  }
});

/**
 * @route DELETE /api/forecast/:sku
 * @desc Delete all forecasts for a specific SKU
 * @access Private
 */
router.delete('/:sku', authenticateToken, async (req, res) => {
  try {
    const { sku } = req.params;

    const deletedCount = await req.db('forecasts')
      .where('sku', sku)
      .delete();

    res.json({
      success: true,
      message: `Deleted ${deletedCount} forecast records for SKU ${sku}`,
      data: { deleted_count: deletedCount }
    });

  } catch (error) {
    req.logger.error('Error deleting forecasts:', error);
    res.status(500).json({ error: 'Failed to delete forecasts' });
  }
});

export default router;