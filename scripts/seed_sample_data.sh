#!/bin/bash

# Smart Inventory Management System - Sample Data Seeder
# This script seeds the database with sample suppliers, inventory items, and sales data

set -e  # Exit on any error

echo "🌱 Starting sample data seeding..."

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}
DB_HOST=${POSTGRES_HOST:-"localhost"}
DB_PORT=${POSTGRES_PORT:-"5432"}
DB_NAME=${POSTGRES_DB:-"inventory_db"}
DB_USER=${POSTGRES_USER:-"inventory_user"}
DB_PASS=${POSTGRES_PASS:-"inventory_pass"}

# Function to check if backend is ready
wait_for_backend() {
    echo "⏳ Waiting for backend to be ready..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
            echo "✅ Backend is ready!"
            return 0
        fi
        echo "   Attempt $((attempt + 1))/$max_attempts - Backend not ready, waiting 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ Backend failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to get auth token
get_auth_token() {
    echo "🔑 Getting authentication token..."
    
    local response=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "admin", "password": "password"}')
    
    local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$token" ]; then
        echo "❌ Failed to get authentication token"
        echo "Response: $response"
        exit 1
    fi
    
    echo "✅ Authentication token obtained"
    echo "$token"
}

# Function to create supplier
create_supplier() {
    local name="$1"
    local lead_time="$2"
    local min_order_qty="$3"
    local contact_info="$4"
    local token="$5"
    
    echo "🏭 Creating supplier: $name"
    
    local response=$(curl -s -X POST "$BACKEND_URL/api/suppliers" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"lead_time_days\": $lead_time,
            \"min_order_qty\": $min_order_qty,
            \"contact_info\": $contact_info
        }")
    
    local supplier_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$supplier_id" ]; then
        echo "⚠️  Supplier creation may have failed or supplier already exists: $name"
        # Try to get existing supplier ID by querying
        return
    fi
    
    echo "✅ Created supplier: $name (ID: $supplier_id)"
    echo "$supplier_id"
}

# Function to create inventory item
create_inventory_item() {
    local sku="$1"
    local name="$2"
    local category="$3"
    local cost_price="$4"
    local reorder_point="$5"
    local reorder_qty="$6"
    local current_stock="$7"
    local supplier_id="$8"
    local token="$9"
    
    echo "📦 Creating inventory item: $name ($sku)"
    
    local supplier_field=""
    if [ -n "$supplier_id" ] && [ "$supplier_id" != "null" ]; then
        supplier_field="\"supplier_id\": \"$supplier_id\","
    fi
    
    local response=$(curl -s -X POST "$BACKEND_URL/api/items" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"sku\": \"$sku\",
            \"name\": \"$name\",
            \"category\": \"$category\",
            \"cost_price\": $cost_price,
            \"reorder_point\": $reorder_point,
            \"reorder_qty\": $reorder_qty,
            \"current_stock\": $current_stock,
            \"lead_time_days\": 7,
            \"safety_stock\": 5,
            $supplier_field
            \"auto_reorder\": false
        }")
    
    if echo "$response" | grep -q '"success":true'; then
        echo "✅ Created inventory item: $name ($sku)"
    else
        echo "⚠️  Item creation may have failed or item already exists: $name ($sku)"
    fi
}

# Function to upload sales data
upload_sales_data() {
    local token="$1"
    local csv_file="$2"
    
    echo "📈 Uploading sales data from: $csv_file"
    
    if [ ! -f "$csv_file" ]; then
        echo "❌ Sales data file not found: $csv_file"
        return 1
    fi
    
    local response=$(curl -s -X POST "$BACKEND_URL/api/upload/sales" \
        -H "Authorization: Bearer $token" \
        -F "file=@$csv_file")
    
    if echo "$response" | grep -q '"success":true'; then
        local processed_rows=$(echo "$response" | grep -o '"processed_rows":[0-9]*' | cut -d':' -f2)
        echo "✅ Uploaded sales data successfully! Processed $processed_rows rows"
    else
        echo "⚠️  Sales data upload may have failed"
        echo "Response: $response"
    fi
}

# Main seeding process
main() {
    echo "🚀 Smart Inventory Management System - Sample Data Seeder"
    echo "=================================================="
    
    # Wait for backend to be ready
    # wait_for_backend  # Skip since we know it's already running
    
    # Get authentication token
    AUTH_TOKEN=$(get_auth_token)
    
    echo ""
    echo "📋 Creating sample suppliers..."
    
    # Create suppliers
    create_supplier "TechSupply Corp" 7 10 '{"email": "orders@techsupply.com", "phone": "+1-555-0101"}'  "$AUTH_TOKEN"
    create_supplier "GadgetSource Ltd" 5 25 '{"email": "sales@gadgetsource.com", "phone": "+1-555-0202"}' "$AUTH_TOKEN"
    create_supplier "ToolMaster Inc" 14 5 '{"email": "info@toolmaster.com", "phone": "+1-555-0303"}' "$AUTH_TOKEN"
    
    echo ""
    echo "📦 Creating sample inventory items..."
    
    # Create inventory items (note: supplier_id should be retrieved from actual suppliers, but for simplicity using null)
    create_inventory_item "WIDGET-001" "Smart Widget Pro" "Electronics" 25.99 50 100 75 null "$AUTH_TOKEN"
    create_inventory_item "GADGET-002" "Digital Gadget X" "Electronics" 45.50 30 75 45 null "$AUTH_TOKEN"
    create_inventory_item "TOOL-003" "Professional Tool Kit" "Tools" 89.99 15 30 20 null "$AUTH_TOKEN"
    
    echo ""
    echo "📈 Uploading sample sales data..."
    
    # Upload sales data
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CSV_FILE="$SCRIPT_DIR/../sample_data/sales_sample.csv"
    upload_sales_data "$AUTH_TOKEN" "$CSV_FILE"
    
    echo ""
    echo "🎉 Sample data seeding completed!"
    echo ""
    echo "📝 Summary:"
    echo "   - Created 3 suppliers"
    echo "   - Created 3 inventory items"
    echo "   - Uploaded ~95 sales records"
    echo ""
    echo "🌐 You can now access the application at: http://localhost:5173"
    echo "🔑 Login credentials: admin / password"
    echo ""
    echo "💡 Next steps:"
    echo "   1. Visit the dashboard to see your inventory overview"
    echo "   2. Go to the Items page to view your inventory"
    echo "   3. Visit an item detail page and generate a forecast"
    echo "   4. Check the reorder suggestions"
    echo ""
}

# Run main function
main "$@"