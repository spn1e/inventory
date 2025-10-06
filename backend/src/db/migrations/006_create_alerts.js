/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('sku', 100);
    table.enum('type', ['low_stock', 'reorder_required', 'forecast_complete', 'system']).notNullable();
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.enum('severity', ['info', 'warning', 'error']).defaultTo('info');
    table.boolean('seen').defaultTo(false);
    table.jsonb('metadata');
    table.timestamps(true, true);
    
    table.foreign('sku').references('sku').inTable('inventory_items').onDelete('CASCADE');
    table.index(['sku']);
    table.index(['type']);
    table.index(['seen']);
    table.index(['created_at']);
    table.index(['severity']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('alerts');
}