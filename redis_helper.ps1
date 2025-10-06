# Redis Helper for Inventory System
# This script helps you interact with your Redis cache

Write-Host "=== 🔴 Redis Helper for Inventory System ===" -ForegroundColor Red
Write-Host "Redis running on localhost:6379" -ForegroundColor Yellow
Write-Host ""

function Redis-Connect {
    param(
        [string]$Command = $null
    )
    
    if ($Command) {
        docker exec -it inventory-redis-1 redis-cli $Command.Split(' ')
    } else {
        Write-Host "Starting interactive Redis session..." -ForegroundColor Yellow
        Write-Host "Type 'exit' to quit, 'KEYS *' to see all keys" -ForegroundColor Gray
        docker exec -it inventory-redis-1 redis-cli
    }
}

function Redis-Stats {
    Write-Host "📊 Redis Statistics:" -ForegroundColor Cyan
    docker exec -it inventory-redis-1 redis-cli INFO stats
}

function Redis-Memory {
    Write-Host "💾 Redis Memory Usage:" -ForegroundColor Cyan
    docker exec -it inventory-redis-1 redis-cli INFO memory
}

function Redis-Keys {
    param([string]$Pattern = "*")
    Write-Host "🗝️ Redis Keys matching '$Pattern':" -ForegroundColor Cyan
    docker exec -it inventory-redis-1 redis-cli KEYS $Pattern
}

function Redis-Set {
    param(
        [string]$Key,
        [string]$Value,
        [int]$TTL = 0
    )
    
    if ($TTL -gt 0) {
        docker exec -it inventory-redis-1 redis-cli SET $Key $Value "EX" $TTL
        Write-Host "✅ Set '$Key' = '$Value' (expires in $TTL seconds)" -ForegroundColor Green
    } else {
        docker exec -it inventory-redis-1 redis-cli SET $Key $Value
        Write-Host "✅ Set '$Key' = '$Value'" -ForegroundColor Green
    }
}

function Redis-Get {
    param([string]$Key)
    $value = docker exec -it inventory-redis-1 redis-cli GET $Key
    Write-Host "📖 '$Key' = $value" -ForegroundColor White
    return $value
}

function Redis-Delete {
    param([string]$Key)
    $result = docker exec -it inventory-redis-1 redis-cli DEL $Key
    if ($result -eq "1") {
        Write-Host "🗑️ Deleted '$Key'" -ForegroundColor Green
    } else {
        Write-Host "❌ Key '$Key' not found" -ForegroundColor Red
    }
}

function Redis-FlushAll {
    Write-Host "⚠️ This will delete ALL data from Redis!" -ForegroundColor Red
    $confirm = Read-Host "Type 'YES' to confirm"
    if ($confirm -eq "YES") {
        docker exec -it inventory-redis-1 redis-cli FLUSHALL
        Write-Host "🧹 All Redis data cleared" -ForegroundColor Yellow
    } else {
        Write-Host "Operation cancelled" -ForegroundColor Gray
    }
}

# Inventory-specific functions
function Cache-InventoryItem {
    param(
        [string]$SKU,
        [string]$Name,
        [int]$Stock,
        [decimal]$Price,
        [int]$TTL = 300
    )
    
    $key = "cache:item:$SKU"
    $value = @{
        name = $Name
        stock = $Stock
        price = $Price
        cached_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json -Compress
    
    Redis-Set -Key $key -Value $value -TTL $TTL
}

function Get-CachedItem {
    param([string]$SKU)
    $key = "cache:item:$SKU"
    $value = docker exec -it inventory-redis-1 redis-cli GET $key
    if ($value -ne "(nil)") {
        Write-Host "📦 Cached item $SKU:" -ForegroundColor Cyan
        $value | ConvertFrom-Json | ConvertTo-Json
    } else {
        Write-Host "❌ No cached data for $SKU" -ForegroundColor Red
    }
}

function Increment-Counter {
    param([string]$CounterName)
    $key = "counter:$CounterName"
    $newValue = docker exec -it inventory-redis-1 redis-cli INCR $key
    Write-Host "📈 Counter '$CounterName' = $newValue" -ForegroundColor Green
}

function Get-Counter {
    param([string]$CounterName)
    $key = "counter:$CounterName"
    $value = docker exec -it inventory-redis-1 redis-cli GET $key
    Write-Host "📊 Counter '$CounterName' = $value" -ForegroundColor White
    return $value
}

Write-Host "Available Redis functions:" -ForegroundColor Green
Write-Host "  Redis-Connect                    # Interactive Redis shell"
Write-Host "  Redis-Stats                      # Show Redis statistics"
Write-Host "  Redis-Memory                     # Show memory usage"
Write-Host "  Redis-Keys                       # List all keys"
Write-Host "  Redis-Set 'key' 'value' [TTL]    # Store data"
Write-Host "  Redis-Get 'key'                  # Retrieve data"
Write-Host "  Redis-Delete 'key'               # Delete data"
Write-Host ""
Write-Host "Inventory-specific functions:" -ForegroundColor Cyan
Write-Host "  Cache-InventoryItem 'SKU' 'Name' Stock Price [TTL]"
Write-Host "  Get-CachedItem 'SKU'"
Write-Host "  Increment-Counter 'name'"
Write-Host "  Get-Counter 'name'"