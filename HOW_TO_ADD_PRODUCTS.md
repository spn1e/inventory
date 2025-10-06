# 🛒 Complete Guide: How to Add New Products

## 🎯 **3 Ways to Add Products**

### **Method 1: Web Interface (Easiest) 🌐**

**Best for**: Beginners, visual interface, clicking and typing

```
1. Open browser: http://localhost:5174
2. Login: 
   - Username: admin
   - Password: password
3. Look for "Add Product" button or "Products" menu
4. Fill out the form:
   - SKU: Unique code (e.g., PRODUCT-001)
   - Name: Product name
   - Category: Electronics, Furniture, etc.
   - Price: Cost price
   - Stock: How many you have
   - Reorder settings (optional)
5. Click "Save" or "Create Product"
```

**✅ Pros**: Easy to use, visual, beginner-friendly
**❌ Cons**: Slower for adding many products

---

### **Method 2: PowerShell API (Recommended) 💻**

**Best for**: Fast bulk adding, programmers, automation

#### **Quick Template:**
```powershell
# 1. Get authentication
$loginBody = @{
    username = "admin"
    password = "password"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = ($loginResponse.Content | ConvertFrom-Json).token

# 2. Create product data
$newProduct = @{
    sku = "YOUR-SKU-001"
    name = "Your Product Name"
    category = "Electronics"
    cost_price = 99.99
    current_stock = 50
    reorder_point = 10
    reorder_qty = 30
    lead_time_days = 7
    safety_stock = 5
    auto_reorder = $true
} | ConvertTo-Json

# 3. Add the product
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/items" -Method POST -Body $newProduct -Headers $headers
$createdProduct = ($response.Content | ConvertFrom-Json).data

Write-Host "✅ Created: $($createdProduct.name)"
```

#### **Real Examples:**
```powershell
# Gaming Mouse
$mouse = @{
    sku = "MOUSE-G001"
    name = "RGB Gaming Mouse"
    category = "Electronics"
    cost_price = 59.99
    current_stock = 40
    reorder_point = 8
    reorder_qty = 25
    lead_time_days = 5
    safety_stock = 3
    auto_reorder = $true
} | ConvertTo-Json

# Office Desk
$desk = @{
    sku = "DESK-O001"
    name = "Executive Office Desk"
    category = "Furniture"
    cost_price = 399.99
    current_stock = 6
    reorder_point = 2
    reorder_qty = 8
    lead_time_days = 14
    safety_stock = 1
    auto_reorder = $false
} | ConvertTo-Json

# Add both products
Invoke-WebRequest -Uri "http://localhost:3001/api/items" -Method POST -Body $mouse -Headers $headers
Invoke-WebRequest -Uri "http://localhost:3001/api/items" -Method POST -Body $desk -Headers $headers
```

**✅ Pros**: Fast, precise, can add many at once
**❌ Cons**: Requires some technical knowledge

---

### **Method 3: Database Direct (Advanced) 🗄️**

**Best for**: Database admins, bulk imports, advanced users

```sql
INSERT INTO inventory_items (
    sku, name, category, cost_price, current_stock, 
    reorder_point, reorder_qty, lead_time_days, 
    safety_stock, auto_reorder
) VALUES (
    'HEADSET-001', 
    'Wireless Gaming Headset', 
    'Electronics', 
    129.99, 
    20, 
    5, 
    15, 
    7, 
    2, 
    true
);
```

**How to use:**
```powershell
# Load database helper
. .\postgres_connect.ps1

# Run the SQL command
Connect-PostgreSQL -Query "INSERT INTO inventory_items (sku, name, category, cost_price, current_stock, reorder_point, reorder_qty, lead_time_days, safety_stock, auto_reorder) VALUES ('SPEAKER-001', 'Bluetooth Speaker', 'Electronics', 79.99, 25, 6, 20, 5, 2, false);"
```

**✅ Pros**: Fastest for bulk operations, direct database access
**❌ Cons**: Most technical, can break things if done wrong

---

## 📋 **Product Fields Explained**

### **Required Fields:**
- **SKU**: Unique product code (like LAPTOP-001, CHAIR-A01)
- **Name**: Human-readable product name
- **Category**: Group products (Electronics, Furniture, Tools, etc.)
- **Cost Price**: What you paid for each item
- **Current Stock**: How many you have right now

### **Optional Fields:**
- **Reorder Point**: When to reorder (default: 5)
- **Reorder Qty**: How many to order (default: 20)
- **Lead Time Days**: Days for delivery (default: 7)
- **Safety Stock**: Emergency buffer (default: 5)
- **Auto Reorder**: Automatic reordering (default: false)

### **Field Examples:**
```
SKU Examples:
✅ LAPTOP-001, MOUSE-G01, DESK-EXEC, PHONE-IP14
❌ laptop1, mouse, my product (avoid spaces/lowercase)

Categories:
✅ Electronics, Furniture, Tools, Clothing, Books
❌ electronics, ELECTRONICS (use proper case)

Prices:
✅ 99.99, 1299.00, 29.50
❌ $99.99, 99, ninety-nine (numbers only)
```

---

## 🎯 **Quick Start Examples**

### **Add a Laptop:**
```powershell
$laptop = @{
    sku = "LAPTOP-002"
    name = "Business Laptop"
    category = "Electronics"
    cost_price = 799.99
    current_stock = 10
    reorder_point = 3
    reorder_qty = 12
    auto_reorder = $true
} | ConvertTo-Json

# (Use the API method above to add)
```

### **Add Office Supplies:**
```powershell
$supplies = @(
    @{ sku="PEN-001"; name="Blue Ballpoint Pens (Pack)"; category="Office"; cost_price=4.99; current_stock=100 },
    @{ sku="PAPER-001"; name="Printer Paper (500 sheets)"; category="Office"; cost_price=8.99; current_stock=50 },
    @{ sku="STAPLER-001"; name="Heavy Duty Stapler"; category="Office"; cost_price=19.99; current_stock=25 }
)

foreach ($item in $supplies) {
    $product = $item | ConvertTo-Json
    # Add using API method
}
```

### **Add Furniture Set:**
```powershell
$furniture = @(
    @{ sku="CHAIR-001"; name="Ergonomic Office Chair"; category="Furniture"; cost_price=199.99; current_stock=8 },
    @{ sku="TABLE-001"; name="Conference Table"; category="Furniture"; cost_price=599.99; current_stock=3 },
    @{ sku="CABINET-001"; name="Filing Cabinet"; category="Furniture"; cost_price=149.99; current_stock=12 }
)
```

---

## ✅ **Verification: Check Your Products**

After adding products, verify they were created:

### **Method 1: Web Interface**
- Go to http://localhost:5174
- Login and view Products page

### **Method 2: Database Query**
```powershell
. .\postgres_connect.ps1
Show-Inventory
```

### **Method 3: API Check**
```powershell
# Get all products
$headers = @{ 'Authorization' = "Bearer $token" }
$response = Invoke-WebRequest -Uri "http://localhost:3001/api/items" -Headers $headers
($response.Content | ConvertFrom-Json).data | Format-Table SKU, Name, Category, Cost_Price, Current_Stock
```

---

## 🚨 **Common Errors & Solutions**

### **"SKU already exists"**
```
Problem: You tried to use a SKU that's already in use
Solution: Choose a unique SKU (check existing ones first)
```

### **"Invalid credentials"**
```
Problem: Login failed
Solution: Use correct credentials (admin/password) or get new token
```

### **"Required field missing"**
```
Problem: You didn't provide all required fields
Solution: Include SKU, name, category, cost_price, current_stock
```

### **"Connection refused"**
```
Problem: Backend not running
Solution: Check docker ps, restart if needed: docker restart inventory-backend-1
```

---

## 🎉 **Success! You Now Know How To:**

- ✅ Add products 3 different ways
- ✅ Understand all product fields
- ✅ Use real examples and templates
- ✅ Verify products were added correctly
- ✅ Fix common problems

---

## 🚀 **Pro Tips**

### **For Speed:**
- Use PowerShell API method for multiple products
- Prepare your data in advance
- Use consistent naming conventions

### **For Organization:**
- Group similar products with consistent SKUs (LAPTOP-001, LAPTOP-002)
- Use meaningful categories
- Set appropriate reorder points

### **For Business:**
- Enable auto-reorder for fast-moving items
- Set realistic lead times
- Include safety stock for critical items

### **For Testing:**
- Start with a few products
- Test the web interface first
- Verify everything works before adding bulk data

---

## 📞 **Need Help?**

1. **Check System Status**: `docker ps`
2. **Restart Frontend**: `docker restart inventory-frontend-1`
3. **View Database**: `. .\postgres_connect.ps1` then `Show-Inventory`
4. **Check Logs**: `docker logs inventory-backend-1 --tail 20`

**Remember**: You now have the power to manage inventory like a professional! 🏪✨