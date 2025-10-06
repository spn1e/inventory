#!/bin/bash
set -e

# Create directories for logs
mkdir -p /tmp/inventory_fix_logs

echo "===== INVENTORY SYSTEM FIX VERIFICATION ====="
echo "Date: $(date --iso-8601=seconds)"
echo

# Step 1: Restart containers
echo "Step 1: Restarting containers..."
docker-compose down --volumes --remove-orphans || true
docker-compose pull --ignore-pull-failures || true
docker-compose up --build -d
echo "Waiting for services to start..."
sleep 15
docker ps --format "table {{.Names}}\t{{.Status}}"

# Step 2: Run migrations and seed data
echo
echo "Step 2: Running migrations and seed data..."
docker-compose exec -T backend sh -c "cd src/db && npx knex migrate:latest" || echo "Migrations may have already run"
docker-compose exec -T backend sh -c "chmod +x scripts/seed_sample_data.sh && scripts/seed_sample_data.sh" || echo "Seed script failed or not present"

# Step 3: Test ML service database connection
echo
echo "Step 3: Testing ML service database connection..."
docker-compose exec -T ml_service python -c "
import os, psycopg2
from urllib.parse import urlparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Try DATABASE_URL first
db_url = os.getenv('DATABASE_URL')
if db_url:
    # Mask password for logging
    sanitized = db_url.replace(db_url.split('@')[0].split(':')[-1], '****') if '@' in db_url else db_url
    logger.info(f'Using DATABASE_URL: {sanitized}')
    
    # Connect using the URL
    conn = psycopg2.connect(db_url)
else:
    # Fall back to individual parameters
    params = {
        'host': os.getenv('PGHOST', 'postgres'),
        'port': os.getenv('PGPORT', '5432'),
        'user': os.getenv('PGUSER', 'inventory_user'),
        'password': os.getenv('PGPASSWORD', 'inventory_pass'),
        'database': os.getenv('PGDATABASE', 'inventory_db')
    }
    logger.info(f'Using connection params: {params}')
    conn = psycopg2.connect(**params)

# Test query
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM sales')
count = cur.fetchone()[0]
print(f'Successfully connected to database. Sales count: {count}')
cur.close()
conn.close()
" | tee /tmp/inventory_fix_logs/ml_db_test.log

# Step 4: Test reorder suggestions endpoint
echo
echo "Step 4: Testing reorder suggestions endpoint..."
curl -s http://localhost:3000/api/reorder/suggestions | tee /tmp/inventory_fix_logs/reorder_suggestions.json
echo
echo "Also testing original endpoint path..."
curl -s http://localhost:3000/api/sales/reorder/suggestions | tee /tmp/inventory_fix_logs/sales_reorder_suggestions.json

# Step 5: Test MLflow health
echo
echo "Step 5: Testing MLflow health..."
curl -s -I http://localhost:5000/ | head -n 1
curl -s -I http://localhost:5000/health | head -n 1 || echo "Health endpoint not available, but root should work"
docker inspect --format='{{json .State.Health}}' $(docker ps --filter "name=mlflow" -q) | tee /tmp/inventory_fix_logs/mlflow_health.json

# Step 6: Test forecast endpoint
echo
echo "Step 6: Testing forecast endpoint..."
# Extract a test SKU from sample data
TEST_SKU=$(head -n 2 sample_data/sales_sample.csv | tail -n 1 | cut -d, -f2)
echo "Using test SKU: $TEST_SKU"

# Request forecast
curl -s -X POST http://localhost:3000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d "{\"sku\":\"$TEST_SKU\",\"horizon_days\":14}" | tee /tmp/inventory_fix_logs/forecast_predict.json

# Get latest forecast
echo
echo "Getting latest forecast..."
curl -s http://localhost:3000/api/forecast/$TEST_SKU/latest | tee /tmp/inventory_fix_logs/forecast_latest.json

# Step 7: Collect logs and produce report
echo
echo "Step 7: Collecting logs and producing report..."
for c in postgres backend ml_service frontend mlflow redis; do
  docker logs --tail 100 $c 2>&1 > /tmp/inventory_fix_logs/${c}.log || true
done

# Check expected statuses
BACKEND_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
ML_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
FORECAST_OK=$(curl -s -X POST http://localhost:3000/api/forecast/predict -H "Content-Type: application/json" -d "{\"sku\":\"$TEST_SKU\",\"horizon_days\":7}" -o /tmp/inventory_fix_logs/forecast_resp.json -w "%{http_code}")
REORDER_OK=$(curl -s -o /tmp/inventory_fix_logs/reorder_resp.json -w "%{http_code}" http://localhost:3000/api/reorder/suggestions)

# Generate report
cat <<EOF > /tmp/inventory_fix_report.txt
Inventory Fix Report
Date: $(date --iso-8601=seconds)

Backend health: $BACKEND_OK
ML health: $ML_OK
Forecast predict POST status: $FORECAST_OK
Reorder route status code: $REORDER_OK

Logs at: /tmp/inventory_fix_logs/
EOF

# Print final result
if [[ "$BACKEND_OK" == "200" && "$ML_OK" == "200" && "$FORECAST_OK" == "200" && "$REORDER_OK" == "200" ]]; then
  echo "RESULT: PASS"
else
  echo "RESULT: FAIL"
fi

echo "Path to the fix report: /tmp/inventory_fix_report.txt"
cat /tmp/inventory_fix_report.txt

echo "Path to logs directory: /tmp/inventory_fix_logs/"
ls -la /tmp/inventory_fix_logs/