# Easy Product Adding Helper for Inventory System
# This script makes adding products super simple!

Write-Host "=== 🛒 Easy Product Adding Helper ===" -ForegroundColor Green
Write-Host ""

function Add-Product {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SKU,
        
        [Parameter(Mandatory=$true)]
        [string]$Name,
        
        [Parameter(Mandatory=$true)]
        [string]$Category,
        
        [Parameter(Mandatory=$true)]
        [decimal]$Price,
        
        [Parameter(Mandatory=$true)]
        [int]$Stock,
        
        [int]$ReorderPoint = 5,
        [int]$ReorderQty = 20,
        [int]$LeadTimeDays = 7,
        [int]$SafetyStock = 2,
        [bool]$AutoReorder = $false
    )
    
    Write-Host "🔐 Getting authentication..." -ForegroundColor Yellow
    
    # Get auth token
    $loginBody = @{
        username = "admin"
        password = "password"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
        $token = ($loginResponse.Content | ConvertFrom-Json).token
        
        # Create product
        $newProduct = @{
            sku = $SKU
            name = $Name
            category = $Category
            cost_price = $Price
            current_stock = $Stock
            reorder_point = $ReorderPoint
            reorder_qty = $ReorderQty
            lead_time_days = $LeadTimeDays
            safety_stock = $SafetyStock
            auto_reorder = $AutoReorder
        } | ConvertTo-Json
        
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        
        Write-Host "📦 Creating product..." -ForegroundColor Yellow
        
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/items" -Method POST -Body $newProduct -Headers $headers
        $createdProduct = ($response.Content | ConvertFrom-Json).data
        
        Write-Host "✅ SUCCESS! Product created:" -ForegroundColor Green
        Write-Host "   SKU: $($createdProduct.sku)" -ForegroundColor Cyan
        Write-Host "   Name: $($createdProduct.name)" -ForegroundColor Cyan
        Write-Host "   Category: $($createdProduct.category)" -ForegroundColor Cyan
        Write-Host "   Price: $($createdProduct.cost_price)" -ForegroundColor Cyan
        Write-Host "   Stock: $($createdProduct.current_stock)" -ForegroundColor Cyan
        Write-Host ""
        
        return $createdProduct
        
    } catch {
        Write-Host "❌ Error adding product:" -ForegroundColor Red
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            Write-Host $responseBody -ForegroundColor Red
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
        return $null
    }
}

function Add-Product-Interactive {
    Write-Host "🎯 Interactive Product Adding" -ForegroundColor Magenta
    Write-Host "Fill in the details below:" -ForegroundColor Yellow
    Write-Host ""
    
    $sku = Read-Host "SKU (e.g., PRODUCT-001)"
    $name = Read-Host "Product Name (e.g., Awesome Product)"
    $category = Read-Host "Category (e.g., Electronics, Furniture, Tools)"
    $price = [decimal](Read-Host "Price (e.g., 99.99)")
    $stock = [int](Read-Host "Current Stock (e.g., 50)")
    
    Write-Host "`nOptional settings (press Enter for defaults):" -ForegroundColor Gray
    
    $reorderInput = Read-Host "Reorder Point (default: 5)"
    $reorderPoint = if ($reorderInput) { [int]$reorderInput } else { 5 }
    
    $qtyInput = Read-Host "Reorder Quantity (default: 20)"
    $reorderQty = if ($qtyInput) { [int]$qtyInput } else { 20 }
    
    $leadInput = Read-Host "Lead Time Days (default: 7)"
    $leadTime = if ($leadInput) { [int]$leadInput } else { 7 }
    
    $safetyInput = Read-Host "Safety Stock (default: 2)"
    $safetyStock = if ($safetyInput) { [int]$safetyInput } else { 2 }
    
    $autoInput = Read-Host "Auto Reorder? (y/N)"
    $autoReorder = ($autoInput -eq "y" -or $autoInput -eq "Y")
    
    Write-Host "`n🚀 Creating your product..." -ForegroundColor Green
    
    Add-Product -SKU $sku -Name $name -Category $category -Price $price -Stock $stock -ReorderPoint $reorderPoint -ReorderQty $reorderQty -LeadTimeDays $leadTime -SafetyStock $safetyStock -AutoReorder $autoReorder
}

function Add-Sample-Products {
    Write-Host "📦 Adding sample products..." -ForegroundColor Cyan
    
    $samples = @(
        @{ SKU="KEYBOARD-001"; Name="Mechanical Keyboard"; Category="Electronics"; Price=79.99; Stock=30 },
        @{ SKU="MOUSE-001"; Name="Gaming Mouse"; Category="Electronics"; Price=49.99; Stock=45 },
        @{ SKU="DESK-001"; Name="Standing Desk"; Category="Furniture"; Price=299.99; Stock=8 },
        @{ SKU="HEADSET-001"; Name="Wireless Headset"; Category="Electronics"; Price=129.99; Stock=22 }
    )
    
    foreach ($sample in $samples) {
        Add-Product -SKU $sample.SKU -Name $sample.Name -Category $sample.Category -Price $sample.Price -Stock $sample.Stock
        Start-Sleep -Seconds 1
    }
    
    Write-Host "✅ Added all sample products!" -ForegroundColor Green
}

function Show-Current-Inventory {
    Write-Host "📋 Current Inventory:" -ForegroundColor Green
    . .\postgres_connect.ps1 2>$null
    Show-Inventory
}

# Show available functions
Write-Host "Available functions:" -ForegroundColor Green
Write-Host "  Add-Product -SKU 'CODE-001' -Name 'Product Name' -Category 'Electronics' -Price 99.99 -Stock 50"
Write-Host "  Add-Product-Interactive          # Guided step-by-step adding"
Write-Host "  Add-Sample-Products              # Add 4 demo products"
Write-Host "  Show-Current-Inventory           # View all products"
Write-Host ""
Write-Host "💡 Examples:" -ForegroundColor Yellow
Write-Host "  Add-Product -SKU 'TABLET-001' -Name 'Gaming Tablet' -Category 'Electronics' -Price 399.99 -Stock 20"
Write-Host "  Add-Product-Interactive"