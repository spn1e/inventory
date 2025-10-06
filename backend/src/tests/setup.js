import knex from 'knex';
import knexConfig from '../db/knexfile.js';

// Test database configuration
const testDb = knex(knexConfig.test);

beforeAll(async () => {
  // Run migrations for test database
  await testDb.migrate.latest();
});

afterAll(async () => {
  // Clean up and close database connection
  await testDb.destroy();
});

beforeEach(async () => {
  // Clean up tables before each test
  await testDb('alerts').del();
  await testDb('forecasts').del();
  await testDb('purchase_orders').del();
  await testDb('sales').del();
  await testDb('inventory_items').del();
  await testDb('suppliers').del();
});

export default testDb;