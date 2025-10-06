# PostgreSQL Connection Helper for Inventory System
# This script helps you connect to your Docker PostgreSQL database

# Database connection details
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "inventory_db"
$DB_USER = "inventory_user"
$DB_PASS = "inventory_pass"

Write-Host "=== PostgreSQL Connection Helper ===" -ForegroundColor Green
Write-Host "Docker Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}" -ForegroundColor Cyan
Write-Host ""

function Connect-PostgreSQL {
    param(
        [string]$Query = $null,
        [switch]$Interactive
    )
    
    # Set password environment variable to avoid prompts
    $env:PGPASSWORD = $DB_PASS
    
    try {
        if ($Interactive) {
            Write-Host "Starting interactive PostgreSQL session..." -ForegroundColor Yellow
            Write-Host "Type \q to exit, \dt to list tables, \d tablename to describe table" -ForegroundColor Gray
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
        } elseif ($Query) {
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $Query
        } else {
            Write-Host "Available functions:" -ForegroundColor Yellow
            Write-Host "  Connect-PostgreSQL -Interactive    # Start interactive session"
            Write-Host "  Connect-PostgreSQL -Query 'SELECT * FROM inventory_items LIMIT 5;'"
            Write-Host "  Show-Tables"
            Write-Host "  Show-Inventory"
            Write-Host "  Show-Sales"
            Write-Host "  Show-Forecasts"
        }
    } finally {
        # Clear password from environment
        $env:PGPASSWORD = $null
    }
}

function Show-Tables {
    Write-Host "Database Tables:" -ForegroundColor Yellow
    Connect-PostgreSQL -Query "\dt"
}

function Show-Inventory {
    Write-Host "Current Inventory:" -ForegroundColor Yellow
    Connect-PostgreSQL -Query "SELECT sku, name, current_stock, cost_price, category FROM inventory_items ORDER BY sku;"
}

function Show-Sales {
    Write-Host "Recent Sales (last 10):" -ForegroundColor Yellow
    Connect-PostgreSQL -Query "SELECT sku, date, qty, unit_price FROM sales ORDER BY date DESC LIMIT 10;"
}

function Show-Forecasts {
    Write-Host "Recent Forecasts:" -ForegroundColor Yellow
    Connect-PostgreSQL -Query "SELECT sku, date, forecast_qty, model_name FROM forecasts ORDER BY created_at DESC LIMIT 10;"
}

function Show-DatabaseSize {
    Write-Host "Database Size Information:" -ForegroundColor Yellow
    Connect-PostgreSQL -Query "
    SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        null_frac,
        avg_width,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
    FROM pg_stats 
    WHERE schemaname = 'public' 
    ORDER BY tablename, attname;"
}

# Export functions
Export-ModuleMember -Function Connect-PostgreSQL, Show-Tables, Show-Inventory, Show-Sales, Show-Forecasts, Show-DatabaseSize

Write-Host "PostgreSQL helper loaded! Available commands:"
Write-Host "  Connect-PostgreSQL -Interactive"
Write-Host "  Show-Tables"
Write-Host "  Show-Inventory" 
Write-Host "  Show-Sales"
Write-Host "  Show-Forecasts"