import express from 'express';
import Joi from 'joi';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Validation schemas
const salesQuerySchema = Joi.object({
  sku: Joi.string().max(100).optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  limit: Joi.number().integer().min(1).max(1000).optional(),
  offset: Joi.number().integer().min(0).optional()
});

/**
 * @route GET /api/sales
 * @desc Get sales data with optional filtering
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { error, value } = salesQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sku, start_date, end_date, limit = 100, offset = 0 } = value;

    let query = req.db('sales as s')
      .leftJoin('inventory_items as i', 's.sku', 'i.sku')
      .select(
        's.*',
        'i.name as item_name',
        'i.category as item_category'
      )
      .orderBy('s.date', 'desc')
      .limit(limit)
      .offset(offset);

    if (sku) {
      query = query.where('s.sku', sku);
    }

    if (start_date) {
      query = query.where('s.date', '>=', start_date);
    }

    if (end_date) {
      query = query.where('s.date', '<=', end_date);
    }

    const sales = await query;

    // Get total count for pagination
    let countQuery = req.db('sales');
    if (sku) countQuery = countQuery.where('sku', sku);
    if (start_date) countQuery = countQuery.where('date', '>=', start_date);
    if (end_date) countQuery = countQuery.where('date', '<=', end_date);
    
    const totalCount = await countQuery.count('* as count').first();

    res.json({
      success: true,
      data: sales.map(sale => ({
        ...sale,
        unit_price: parseFloat(sale.unit_price)
      })),
      pagination: {
        total: parseInt(totalCount.count),
        limit,
        offset,
        has_more: parseInt(totalCount.count) > offset + limit
      }
    });

  } catch (error) {
    req.logger.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

/**
 * @route GET /api/sales/analytics/summary
 * @desc Get sales analytics summary
 * @access Public
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Total sales in specified period
    const totalSales = await req.db('sales')
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        req.db.raw('COUNT(*) as total_transactions'),
        req.db.raw('SUM(qty) as total_quantity'),
        req.db.raw('SUM(qty * unit_price) as total_revenue'),
        req.db.raw('COUNT(DISTINCT sku) as unique_skus')
      )
      .first();

    // Top selling products
    const topProducts = await req.db('sales')
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .leftJoin('inventory_items', 'sales.sku', 'inventory_items.sku')
      .select(
        'sales.sku',
        'inventory_items.name',
        req.db.raw('SUM(sales.qty) as total_sold'),
        req.db.raw('SUM(sales.qty * sales.unit_price) as revenue')
      )
      .groupBy('sales.sku', 'inventory_items.name')
      .orderBy('total_sold', 'desc')
      .limit(10);

    // Daily sales trend
    const dailyTrend = await req.db('sales')
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        'date',
        req.db.raw('SUM(qty) as daily_quantity'),
        req.db.raw('SUM(qty * unit_price) as daily_revenue'),
        req.db.raw('COUNT(*) as daily_transactions')
      )
      .groupBy('date')
      .orderBy('date', 'desc');

    // Sales by category
    const categoryBreakdown = await req.db('sales')
      .leftJoin('inventory_items', 'sales.sku', 'inventory_items.sku')
      .where('sales.date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        'inventory_items.category',
        req.db.raw('SUM(sales.qty) as total_sold'),
        req.db.raw('SUM(sales.qty * sales.unit_price) as revenue')
      )
      .groupBy('inventory_items.category')
      .orderBy('total_sold', 'desc');

    res.json({
      success: true,
      data: {
        summary: {
          total_transactions: parseInt(totalSales.total_transactions),
          total_quantity: parseInt(totalSales.total_quantity || 0),
          total_revenue: parseFloat(totalSales.total_revenue || 0),
          unique_skus: parseInt(totalSales.unique_skus)
        },
        top_products: topProducts.map(p => ({
          ...p,
          total_sold: parseInt(p.total_sold),
          revenue: parseFloat(p.revenue)
        })),
        daily_trend: dailyTrend.map(d => ({
          date: d.date,
          quantity: parseInt(d.daily_quantity),
          revenue: parseFloat(d.daily_revenue),
          transactions: parseInt(d.daily_transactions)
        })),
        category_breakdown: categoryBreakdown.map(c => ({
          category: c.category || 'Uncategorized',
          total_sold: parseInt(c.total_sold),
          revenue: parseFloat(c.revenue)
        })),
        period_days: parseInt(days)
      }
    });

  } catch (error) {
    req.logger.error('Error fetching sales analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

/**
 * @route GET /api/sales/:sku/history
 * @desc Get sales history for specific SKU
 * @access Public
 */
router.get('/:sku/history', async (req, res) => {
  try {
    const { sku } = req.params;
    const { days = 90 } = req.query;

    // Check if SKU exists
    const item = await req.db('inventory_items')
      .where('sku', sku)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    // Get sales history
    const salesHistory = await req.db('sales')
      .where('sku', sku)
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        'date',
        'qty',
        'unit_price',
        'order_id',
        'created_at'
      )
      .orderBy('date', 'desc');

    // Get aggregated daily sales
    const dailyAggregation = await req.db('sales')
      .where('sku', sku)
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        'date',
        req.db.raw('SUM(qty) as total_qty'),
        req.db.raw('AVG(unit_price) as avg_price'),
        req.db.raw('COUNT(*) as transaction_count')
      )
      .groupBy('date')
      .orderBy('date', 'desc');

    // Calculate statistics
    const stats = await req.db('sales')
      .where('sku', sku)
      .where('date', '>=', req.db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .select(
        req.db.raw('SUM(qty) as total_sold'),
        req.db.raw('AVG(qty) as avg_qty_per_transaction'),
        req.db.raw('MIN(qty) as min_qty'),
        req.db.raw('MAX(qty) as max_qty'),
        req.db.raw('AVG(unit_price) as avg_unit_price'),
        req.db.raw('COUNT(*) as total_transactions')
      )
      .first();

    res.json({
      success: true,
      data: {
        sku,
        item_name: item.name,
        period_days: parseInt(days),
        sales_history: salesHistory.map(s => ({
          ...s,
          unit_price: parseFloat(s.unit_price)
        })),
        daily_aggregation: dailyAggregation.map(d => ({
          date: d.date,
          total_qty: parseInt(d.total_qty),
          avg_price: parseFloat(d.avg_price),
          transaction_count: parseInt(d.transaction_count)
        })),
        statistics: {
          total_sold: parseInt(stats.total_sold || 0),
          avg_qty_per_transaction: parseFloat(stats.avg_qty_per_transaction || 0),
          min_qty: parseInt(stats.min_qty || 0),
          max_qty: parseInt(stats.max_qty || 0),
          avg_unit_price: parseFloat(stats.avg_unit_price || 0),
          total_transactions: parseInt(stats.total_transactions || 0)
        }
      }
    });

  } catch (error) {
    req.logger.error('Error fetching sales history:', error);
    res.status(500).json({ error: 'Failed to fetch sales history' });
  }
});

/**
 * @route GET /api/reorder/suggestions
 * @desc Get reorder suggestions based on current stock and forecasts
 * @access Private
 */
router.get('/reorder/suggestions', authenticateToken, async (req, res) => {
  try {
    // Get items that need reordering (current stock <= reorder point)
    const lowStockItems = await req.db('inventory_items as i')
      .leftJoin('suppliers as s', 'i.supplier_id', 's.id')
      .whereRaw('i.current_stock <= i.reorder_point')
      .select(
        'i.*',
        's.name as supplier_name',
        's.lead_time_days as supplier_lead_time',
        's.min_order_qty as supplier_min_order_qty'
      );

    const suggestions = [];

    for (const item of lowStockItems) {
      try {
        // Get recent sales velocity (avg daily sales over last 30 days)
        const salesVelocity = await req.db('sales')
          .where('sku', item.sku)
          .where('date', '>=', req.db.raw('CURRENT_DATE - INTERVAL \'30 days\''))
          .select(req.db.raw('AVG(daily_qty) as avg_daily_sales'))
          .from(
            req.db('sales')
              .where('sku', item.sku)
              .where('date', '>=', req.db.raw('CURRENT_DATE - INTERVAL \'30 days\''))
              .select('date', req.db.raw('SUM(qty) as daily_qty'))
              .groupBy('date')
              .as('daily_sales')
          )
          .first();

        const avgDailySales = parseFloat(salesVelocity?.avg_daily_sales || 0);

        // Get forecast for lead time + buffer
        const leadTime = item.supplier_lead_time || item.lead_time_days || 7;
        const bufferDays = 14; // 2 weeks buffer
        const forecastPeriod = leadTime + bufferDays;

        const forecast = await req.db('forecasts')
          .where('sku', item.sku)
          .where('date', '>=', req.db.raw('CURRENT_DATE'))
          .where('date', '<=', req.db.raw(`CURRENT_DATE + INTERVAL '${forecastPeriod} days'`))
          .select(req.db.raw('SUM(forecast_qty) as total_forecast'))
          .first();

        const forecastDemand = parseFloat(forecast?.total_forecast || 0);

        // Calculate different reorder quantities
        const safetyStock = item.safety_stock || 0;
        const minOrderQty = item.supplier_min_order_qty || item.reorder_qty || 1;

        // Method 1: Based on forecast
        let forecastBasedQty = Math.max(
          forecastDemand + safetyStock - item.current_stock,
          0
        );

        // Method 2: Based on sales velocity
        let velocityBasedQty = Math.max(
          (avgDailySales * forecastPeriod) + safetyStock - item.current_stock,
          0
        );

        // Method 3: Simple reorder quantity
        let simpleReorderQty = item.reorder_qty || minOrderQty;

        // Choose the maximum of the three methods, but ensure minimum order quantity
        let recommendedQty = Math.max(
          forecastBasedQty,
          velocityBasedQty,
          simpleReorderQty,
          minOrderQty
        );

        // Calculate urgency score (lower stock = higher urgency)
        const stockRatio = item.current_stock / (item.reorder_point || 1);
        const urgencyScore = Math.max(0, Math.min(10, 10 - (stockRatio * 10)));

        // Calculate days of stock remaining
        const daysRemaining = avgDailySales > 0 
          ? Math.floor(item.current_stock / avgDailySales)
          : 999;

        suggestions.push({
          sku: item.sku,
          name: item.name,
          category: item.category,
          current_stock: item.current_stock,
          reorder_point: item.reorder_point,
          safety_stock: safetyStock,
          recommended_order_qty: Math.round(recommendedQty),
          supplier: {
            id: item.supplier_id,
            name: item.supplier_name,
            lead_time_days: item.supplier_lead_time || item.lead_time_days,
            min_order_qty: minOrderQty
          },
          analytics: {
            avg_daily_sales: Math.round(avgDailySales * 100) / 100,
            forecast_demand: Math.round(forecastDemand * 100) / 100,
            days_remaining: daysRemaining,
            urgency_score: Math.round(urgencyScore * 10) / 10,
            stock_ratio: Math.round(stockRatio * 100) / 100
          },
          calculation_methods: {
            forecast_based: Math.round(forecastBasedQty),
            velocity_based: Math.round(velocityBasedQty),
            simple_reorder: simpleReorderQty
          }
        });

      } catch (itemError) {
        req.logger.warn(`Error calculating reorder for SKU ${item.sku}:`, itemError);
        // Still include basic suggestion even if advanced calculations fail
        suggestions.push({
          sku: item.sku,
          name: item.name,
          current_stock: item.current_stock,
          reorder_point: item.reorder_point,
          recommended_order_qty: item.reorder_qty || (item.supplier_min_order_qty || 1),
          supplier: {
            id: item.supplier_id,
            name: item.supplier_name,
            lead_time_days: item.supplier_lead_time || item.lead_time_days
          },
          analytics: {
            urgency_score: 5, // Medium urgency as fallback
            calculation_error: true
          }
        });
      }
    }

    // Sort by urgency score (highest first)
    suggestions.sort((a, b) => (b.analytics?.urgency_score || 0) - (a.analytics?.urgency_score || 0));

    // Create alerts for urgent reorders
    for (const suggestion of suggestions.slice(0, 5)) { // Top 5 urgent items
      if (suggestion.analytics?.urgency_score >= 7) {
        await req.db('alerts').insert({
          sku: suggestion.sku,
          type: 'reorder_required',
          title: 'Urgent Reorder Required',
          message: `${suggestion.name} (${suggestion.sku}) is running low. Current stock: ${suggestion.current_stock}, Recommended order: ${suggestion.recommended_order_qty}`,
          severity: 'warning',
          metadata: JSON.stringify({
            current_stock: suggestion.current_stock,
            recommended_qty: suggestion.recommended_order_qty,
            urgency_score: suggestion.analytics.urgency_score
          })
        });
      }
    }

    // Emit socket event if there are urgent suggestions
    const urgentSuggestions = suggestions.filter(s => s.analytics?.urgency_score >= 7);
    if (urgentSuggestions.length > 0) {
      req.io.emit('alert_created', {
        type: 'reorder_required',
        count: urgentSuggestions.length,
        urgent_skus: urgentSuggestions.map(s => s.sku)
      });
    }

    res.json({
      success: true,
      data: {
        suggestions,
        summary: {
          total_items_needing_reorder: suggestions.length,
          urgent_items: urgentSuggestions.length,
          total_recommended_orders: suggestions.reduce((sum, s) => sum + s.recommended_order_qty, 0)
        }
      }
    });

  } catch (error) {
    req.logger.error('Error generating reorder suggestions:', error);
    res.status(500).json({ error: 'Failed to generate reorder suggestions' });
  }
});

/**
 * @route POST /api/purchase-orders
 * @desc Create purchase order
 * @access Private
 */
router.post('/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const { sku, qty, supplier_id, unit_cost, notes } = req.body;

    // Validate required fields
    if (!sku || !qty || !supplier_id) {
      return res.status(400).json({ error: 'SKU, quantity, and supplier are required' });
    }

    // Check if SKU and supplier exist
    const [item, supplier] = await Promise.all([
      req.db('inventory_items').where('sku', sku).first(),
      req.db('suppliers').where('id', supplier_id).first()
    ]);

    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Calculate expected delivery date
    const leadTime = supplier.lead_time_days || 7;
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + leadTime);

    const purchaseOrder = {
      sku,
      qty: parseInt(qty),
      supplier_id,
      unit_cost: unit_cost ? parseFloat(unit_cost) : null,
      total_cost: unit_cost ? parseFloat(unit_cost) * parseInt(qty) : null,
      expected_delivery_date: expectedDelivery.toISOString().split('T')[0],
      notes,
      status: 'pending'
    };

    const [newOrder] = await req.db('purchase_orders')
      .insert(purchaseOrder)
      .returning('*');

    // Create alert
    await req.db('alerts').insert({
      sku,
      type: 'system',
      title: 'Purchase Order Created',
      message: `Purchase order created for ${qty} units of ${item.name} from ${supplier.name}`,
      severity: 'info',
      metadata: JSON.stringify({
        order_id: newOrder.id,
        qty,
        supplier: supplier.name
      })
    });

    // Emit socket event
    req.io.emit('inventory_update', {
      type: 'purchase_order_created',
      data: newOrder
    });

    res.status(201).json({
      success: true,
      data: newOrder
    });

  } catch (error) {
    req.logger.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

export default router;