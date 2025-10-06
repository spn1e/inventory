import request from 'supertest';
import app from '../app.js';
import testDb from './setup.js';

describe('Items Endpoints', () => {
  let authToken;
  let testSupplier;
  let testItem;

  beforeEach(async () => {
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'password'
      });
    authToken = loginResponse.body.token;

    // Create test supplier
    const supplierData = {
      name: 'Test Supplier',
      lead_time_days: 7,
      min_order_qty: 10,
      contact_info: { email: 'supplier@test.com' }
    };
    [testSupplier] = await testDb('suppliers').insert(supplierData).returning('*');

    // Create test item
    const itemData = {
      sku: 'TEST-001',
      name: 'Test Item',
      category: 'Electronics',
      cost_price: 25.99,
      reorder_point: 10,
      reorder_qty: 50,
      lead_time_days: 7,
      safety_stock: 5,
      current_stock: 25,
      supplier_id: testSupplier.id,
      auto_reorder: false
    };
    [testItem] = await testDb('inventory_items').insert(itemData).returning('*');
  });

  describe('GET /api/items', () => {
    it('should return all items', async () => {
      const response = await request(app)
        .get('/api/items');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.count).toBe(response.body.data.length);
    });

    it('should filter items by category', async () => {
      const response = await request(app)
        .get('/api/items?category=Electronics');

      expect(response.status).toBe(200);
      expect(response.body.data.every(item => item.category === 'Electronics')).toBe(true);
    });

    it('should filter items by low stock', async () => {
      // Update item to have low stock
      await testDb('inventory_items')
        .where('id', testItem.id)
        .update({ current_stock: 5, reorder_point: 10 });

      const response = await request(app)
        .get('/api/items?low_stock=true');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/items/:sku', () => {
    it('should return item by SKU', async () => {
      const response = await request(app)
        .get(`/api/items/${testItem.sku}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sku).toBe(testItem.sku);
      expect(response.body.data.name).toBe(testItem.name);
      expect(response.body.data.supplier_name).toBe(testSupplier.name);
    });

    it('should return 404 for non-existent SKU', async () => {
      const response = await request(app)
        .get('/api/items/NON-EXISTENT');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('POST /api/items', () => {
    const newItemData = {
      sku: 'NEW-001',
      name: 'New Test Item',
      category: 'Tools',
      cost_price: 15.50,
      reorder_point: 20,
      reorder_qty: 100,
      lead_time_days: 14,
      safety_stock: 10,
      current_stock: 50,
      auto_reorder: true
    };

    it('should create new item with authentication', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItemData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sku).toBe(newItemData.sku);
      expect(response.body.data.name).toBe(newItemData.name);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/items')
        .send(newItemData);

      expect(response.status).toBe(401);
    });

    it('should reject duplicate SKU', async () => {
      const duplicateData = { ...newItemData, sku: testItem.sku };

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('SKU already exists');
    });

    it('should validate required fields', async () => {
      const invalidData = { ...newItemData };
      delete invalidData.sku;

      const response = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sku');
    });
  });

  describe('PUT /api/items/:sku', () => {
    const updateData = {
      name: 'Updated Test Item',
      current_stock: 100,
      reorder_point: 15
    };

    it('should update existing item with authentication', async () => {
      const response = await request(app)
        .put(`/api/items/${testItem.sku}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.current_stock).toBe(updateData.current_stock);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .put(`/api/items/${testItem.sku}`)
        .send(updateData);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent SKU', async () => {
      const response = await request(app)
        .put('/api/items/NON-EXISTENT')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('DELETE /api/items/:sku', () => {
    it('should delete existing item with authentication', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItem.sku}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify item is deleted
      const checkResponse = await request(app)
        .get(`/api/items/${testItem.sku}`);
      expect(checkResponse.status).toBe(404);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .delete(`/api/items/${testItem.sku}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent SKU', async () => {
      const response = await request(app)
        .delete('/api/items/NON-EXISTENT')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('GET /api/items/categories/list', () => {
    it('should return list of categories', async () => {
      const response = await request(app)
        .get('/api/items/categories/list');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toContain('Electronics');
    });
  });
});