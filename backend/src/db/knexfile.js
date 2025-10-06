import { config } from 'dotenv';
config();

const commonConfig = {
  client: 'pg',
  migrations: {
    directory: '/app/src/db/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

const configurations = {
  development: {
    ...commonConfig,
    connection: {
      connectionString: process.env.DATABASE_URL || 'postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db',
      ssl: false
    },
    pool: {
      min: 2,
      max: 10
    }
  },
  test: {
    ...commonConfig,
    connection: {
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://inventory_user:inventory_pass@localhost:5432/inventory_test_db',
      ssl: false
    },
    pool: {
      min: 1,
      max: 2
    }
  },
  production: {
    ...commonConfig,
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    }
  }
};

export default configurations;