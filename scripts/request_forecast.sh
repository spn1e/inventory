#!/bin/bash

# Smart Inventory Management System - Forecast Request Script
# This script demonstrates how to request a forecast for a specific SKU

set -e

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:3000"}
SKU=${1:-"WIDGET-001"}
HORIZON_DAYS=${2:-30}

echo "🔮 Requesting forecast for SKU: $SKU"
echo "📅 Forecast horizon: $HORIZON_DAYS days"
echo ""

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

# Function to check if item exists
check_item() {
    local sku="$1"
    
    echo "📦 Checking if item exists: $sku"
    
    local response=$(curl -s "$BACKEND_URL/api/items/$sku")
    
    if echo "$response" | grep -q '"success":true'; then
        echo "✅ Item found: $sku"
        local item_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        echo "   Name: $item_name"
        return 0
    else
        echo "❌ Item not found: $sku"
        return 1
    fi
}

# Function to request forecast
request_forecast() {
    local sku="$1"
    local horizon_days="$2"
    local token="$3"
    
    echo "🧠 Requesting forecast generation..."
    
    local response=$(curl -s -X POST "$BACKEND_URL/api/forecast/predict" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"sku\": \"$sku\",
            \"horizon_days\": $horizon_days
        }")
    
    if echo "$response" | grep -q '"success":true'; then
        echo "✅ Forecast generated successfully!"
        
        # Extract forecast summary
        local model_name=$(echo "$response" | grep -o '"model_name":"[^"]*"' | cut -d'"' -f4)
        echo "   Model: $model_name"
        
        # Try to extract some forecast data (first few points)
        echo "   📊 Forecast preview (first 5 days):"
        echo "$response" | grep -o '"forecast":\[[^]]*\]' | sed 's/.*"forecast":\[//' | sed 's/\].*//' | \
        head -c 500 | python3 -c "
import sys, json
try:
    data = sys.stdin.read()
    # Simple parsing to show first few forecast points
    if 'date' in data:
        print('      (Forecast data generated - view in application for details)')
except:
    print('      (Forecast generated - view details in application)')
"
        
    else
        echo "❌ Forecast generation failed"
        echo "Response: $response"
        return 1
    fi
}

# Function to get latest forecast
get_latest_forecast() {
    local sku="$1"
    
    echo "📈 Retrieving latest forecast..."
    
    local response=$(curl -s "$BACKEND_URL/api/forecast/$sku/latest?days=30")
    
    if echo "$response" | grep -q '"forecasts"'; then
        local forecast_count=$(echo "$response" | grep -o '"forecasts":\[[^]]*\]' | grep -o '{"date"' | wc -l)
        echo "✅ Found existing forecast with $forecast_count data points"
        
        # Show last updated time if available
        local last_updated=$(echo "$response" | grep -o '"last_updated":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$last_updated" ]; then
            echo "   Last updated: $last_updated"
        fi
    else
        echo "ℹ️  No existing forecast found"
    fi
}

# Function to poll for forecast completion (if using background processing)
poll_forecast_completion() {
    local sku="$1"
    local max_attempts=12
    local attempt=0
    
    echo "⏳ Polling for forecast completion..."
    
    while [ $attempt -lt $max_attempts ]; do
        sleep 5
        attempt=$((attempt + 1))
        
        echo "   Attempt $attempt/$max_attempts - Checking forecast status..."
        
        local response=$(curl -s "$BACKEND_URL/api/forecast/$sku/latest?days=30")
        
        if echo "$response" | grep -q '"forecasts"'; then
            echo "✅ Forecast is ready!"
            return 0
        fi
    done
    
    echo "⚠️  Forecast may still be processing. Check the application dashboard."
    return 1
}

# Main function
main() {
    echo "🚀 Smart Inventory Management System - Forecast Request"
    echo "======================================================"
    
    # Check if item exists
    if ! check_item "$SKU"; then
        echo ""
        echo "💡 Available SKUs in sample data:"
        echo "   - WIDGET-001 (Smart Widget Pro)"
        echo "   - GADGET-002 (Digital Gadget X)" 
        echo "   - TOOL-003 (Professional Tool Kit)"
        echo ""
        echo "Usage: $0 <SKU> [HORIZON_DAYS]"
        echo "Example: $0 WIDGET-001 30"
        exit 1
    fi
    
    # Get existing forecast first
    get_latest_forecast "$SKU"
    
    # Get auth token
    AUTH_TOKEN=$(get_auth_token)
    
    # Request new forecast
    echo ""
    request_forecast "$SKU" "$HORIZON_DAYS" "$AUTH_TOKEN"
    
    echo ""
    echo "🎉 Forecast request completed!"
    echo ""
    echo "📱 Next steps:"
    echo "   1. Open the web application: http://localhost:5173"
    echo "   2. Navigate to Items -> $SKU"
    echo "   3. View the generated forecast chart"
    echo "   4. Check the forecast metrics and accuracy"
    echo ""
    echo "🔄 You can also check reorder suggestions:"
    echo "   curl -H 'Authorization: Bearer $AUTH_TOKEN' $BACKEND_URL/api/reorder/suggestions"
    echo ""
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <SKU> [HORIZON_DAYS]"
    echo ""
    echo "Examples:"
    echo "  $0 WIDGET-001          # 30-day forecast for WIDGET-001"
    echo "  $0 GADGET-002 60       # 60-day forecast for GADGET-002"
    echo ""
    exit 1
fi

# Run main function
main "$@"