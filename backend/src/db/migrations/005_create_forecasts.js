/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('forecasts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('sku', 100).notNullable();
    table.date('date').notNullable();
    table.decimal('forecast_qty', 10, 2).notNullable();
    table.string('model_name', 100).defaultTo('prophet');
    table.decimal('confidence_lower', 10, 2);
    table.decimal('confidence_upper', 10, 2);
    table.jsonb('model_metrics');
    table.timestamps(true, true);
    
    table.foreign('sku').references('sku').inTable('inventory_items').onDelete('CASCADE');
    table.index(['sku', 'date']);
    table.index(['date']);
    table.index(['model_name']);
    table.index(['created_at']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('forecasts');
}