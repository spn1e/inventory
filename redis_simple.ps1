# Simple Redis Helper for Inventory System

Write-Host "=== 🔴 Simple Redis Helper ===" -ForegroundColor Red
Write-Host ""

function Redis-Test {
    Write-Host "Testing Redis connection..." -ForegroundColor Yellow
    docker exec -it inventory-redis-1 redis-cli PING
}

function Redis-Keys {
    Write-Host "All Redis keys:" -ForegroundColor Cyan
    docker exec -it inventory-redis-1 redis-cli KEYS "*"
}

function Redis-Set-Simple {
    param($Key, $Value)
    docker exec -it inventory-redis-1 redis-cli SET $Key $Value
    Write-Host "✅ Set $Key = $Value" -ForegroundColor Green
}

function Redis-Get-Simple {
    param($Key)
    $result = docker exec -it inventory-redis-1 redis-cli GET $Key
    Write-Host "📖 $Key = $result" -ForegroundColor White
}

function Redis-Shell {
    Write-Host "Starting Redis interactive shell..." -ForegroundColor Yellow
    Write-Host "Type 'exit' to quit" -ForegroundColor Gray
    docker exec -it inventory-redis-1 redis-cli
}

Write-Host "Available functions:" -ForegroundColor Green
Write-Host "  Redis-Test        # Test connection"
Write-Host "  Redis-Keys        # List all keys" 
Write-Host "  Redis-Set-Simple 'key' 'value'"
Write-Host "  Redis-Get-Simple 'key'"
Write-Host "  Redis-Shell       # Interactive mode"