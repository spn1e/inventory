/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('purchase_orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('sku', 100).notNullable();
    table.integer('qty').notNullable();
    table.uuid('supplier_id').notNullable();
    table.enum('status', ['pending', 'ordered', 'received', 'cancelled']).defaultTo('pending');
    table.decimal('unit_cost', 10, 2);
    table.decimal('total_cost', 10, 2);
    table.date('expected_delivery_date');
    table.date('actual_delivery_date');
    table.text('notes');
    table.timestamps(true, true);
    
    table.foreign('sku').references('sku').inTable('inventory_items').onDelete('CASCADE');
    table.foreign('supplier_id').references('id').inTable('suppliers').onDelete('CASCADE');
    table.index(['sku']);
    table.index(['supplier_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('purchase_orders');
}