import express from 'express';
import Joi from 'joi';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Validation schemas
const itemSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  category: Joi.string().max(100).optional(),
  cost_price: Joi.number().precision(2).min(0).optional(),
  reorder_point: Joi.number().integer().min(0).optional(),
  reorder_qty: Joi.number().integer().min(1).optional(),
  lead_time_days: Joi.number().integer().min(1).optional(),
  safety_stock: Joi.number().integer().min(0).optional(),
  current_stock: Joi.number().integer().min(0).optional(),
  supplier_id: Joi.string().uuid().optional().allow(null),
  auto_reorder: Joi.boolean().optional()
});

const updateItemSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  category: Joi.string().max(100).optional(),
  cost_price: Joi.number().precision(2).min(0).optional(),
  reorder_point: Joi.number().integer().min(0).optional(),
  reorder_qty: Joi.number().integer().min(1).optional(),
  lead_time_days: Joi.number().integer().min(1).optional(),
  safety_stock: Joi.number().integer().min(0).optional(),
  current_stock: Joi.number().integer().min(0).optional(),
  supplier_id: Joi.string().uuid().optional().allow(null),
  auto_reorder: Joi.boolean().optional()
});

/**
 * @route GET /api/items
 * @desc Get all inventory items
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { category, low_stock } = req.query;
    let query = req.db('inventory_items as i')
      .leftJoin('suppliers as s', 'i.supplier_id', 's.id')
      .select(
        'i.*',
        's.name as supplier_name',
        's.lead_time_days as supplier_lead_time'
      );

    if (category) {
      query = query.where('i.category', category);
    }

    if (low_stock === 'true') {
      query = query.whereRaw('i.current_stock <= i.reorder_point');
    }

    const items = await query.orderBy('i.sku');

    res.json({
      success: true,
      data: items,
      count: items.length
    });

  } catch (error) {
    req.logger.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/**
 * @route GET /api/items/categories/list
 * @desc Get list of all categories
 * @access Public
 */
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await req.db('inventory_items')
      .distinct('category')
      .whereNotNull('category')
      .orderBy('category');

    res.json({
      success: true,
      data: categories.map(c => c.category)
    });

  } catch (error) {
    req.logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * @route GET /api/items/:sku
 * @desc Get single inventory item by SKU
 * @access Public
 */
router.get('/:sku', async (req, res) => {
  try {
    const { sku } = req.params;

    const item = await req.db('inventory_items as i')
      .leftJoin('suppliers as s', 'i.supplier_id', 's.id')
      .select(
        'i.*',
        's.name as supplier_name',
        's.lead_time_days as supplier_lead_time',
        's.min_order_qty as supplier_min_order_qty',
        's.contact_info as supplier_contact_info'
      )
      .where('i.sku', sku)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get recent sales data
    const recentSales = await req.db('sales')
      .where('sku', sku)
      .orderBy('date', 'desc')
      .limit(30);

    // Get latest forecast if available
    const latestForecast = await req.db('forecasts')
      .where('sku', sku)
      .orderBy('created_at', 'desc')
      .limit(1);

    res.json({
      success: true,
      data: {
        ...item,
        recent_sales: recentSales,
        latest_forecast: latestForecast[0] || null
      }
    });

  } catch (error) {
    req.logger.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

/**
 * @route POST /api/items
 * @desc Create new inventory item
 * @access Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { error, value } = itemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if SKU already exists
    const existingItem = await req.db('inventory_items')
      .where('sku', value.sku)
      .first();

    if (existingItem) {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    const [newItem] = await req.db('inventory_items')
      .insert(value)
      .returning('*');

    // Emit socket event
    req.io.emit('inventory_update', {
      type: 'item_created',
      data: newItem
    });

    res.status(201).json({
      success: true,
      data: newItem
    });

  } catch (error) {
    req.logger.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

/**
 * @route PUT /api/items/:sku
 * @desc Update inventory item
 * @access Private
 */
router.put('/:sku', authenticateToken, async (req, res) => {
  try {
    const { sku } = req.params;
    const { error, value } = updateItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [updatedItem] = await req.db('inventory_items')
      .where('sku', sku)
      .update({ ...value, updated_at: req.db.fn.now() })
      .returning('*');

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Emit socket event
    req.io.emit('inventory_update', {
      type: 'item_updated',
      data: updatedItem
    });

    res.json({
      success: true,
      data: updatedItem
    });

  } catch (error) {
    req.logger.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * @route DELETE /api/items/:sku
 * @desc Delete inventory item
 * @access Private
 */
router.delete('/:sku', authenticateToken, async (req, res) => {
  try {
    const { sku } = req.params;

    const deletedCount = await req.db('inventory_items')
      .where('sku', sku)
      .delete();

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Emit socket event
    req.io.emit('inventory_update', {
      type: 'item_deleted',
      data: { sku }
    });

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    req.logger.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;