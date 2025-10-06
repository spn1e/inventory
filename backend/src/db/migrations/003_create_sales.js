/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('sales', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('sku', 100).notNullable();
    table.date('date').notNullable();
    table.integer('qty').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.string('order_id', 100);
    table.timestamps(true, true);
    
    table.foreign('sku').references('sku').inTable('inventory_items').onDelete('CASCADE');
    table.index(['sku', 'date']);
    table.index(['date']);
    table.index(['order_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('sales');
}