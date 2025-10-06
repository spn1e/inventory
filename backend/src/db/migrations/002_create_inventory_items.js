/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('inventory_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('sku', 100).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('category', 100);
    table.decimal('cost_price', 10, 2).defaultTo(0);
    table.integer('reorder_point').defaultTo(10);
    table.integer('reorder_qty').defaultTo(50);
    table.integer('lead_time_days').defaultTo(7);
    table.integer('safety_stock').defaultTo(5);
    table.integer('current_stock').defaultTo(0);
    table.uuid('supplier_id');
    table.boolean('auto_reorder').defaultTo(false);
    table.timestamps(true, true);
    
    table.foreign('supplier_id').references('id').inTable('suppliers').onDelete('SET NULL');
    table.index(['sku']);
    table.index(['category']);
    table.index(['supplier_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('inventory_items');
}