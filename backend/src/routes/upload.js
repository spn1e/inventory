import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { authenticateToken } from './auth.js';
import axios from 'axios';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

/**
 * Parse CSV file and return sales data
 */
async function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    parser.on('readable', function() {
      let record;
      while (record = parser.read()) {
        results.push(record);
      }
    });

    parser.on('error', (err) => {
      reject(err);
    });

    parser.on('end', () => {
      resolve(results);
    });

    fs.createReadStream(filePath).pipe(parser);
  });
}

/**
 * Parse Excel file and return sales data
 */
async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.worksheets[0];
  const results = [];
  
  // Get headers from first row
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });
  
  // Process data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    const rowData = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        rowData[header] = cell.value;
      }
    });
    
    if (Object.keys(rowData).length > 0) {
      results.push(rowData);
    }
  });
  
  return results;
}

/**
 * Validate and normalize sales data
 */
function validateSalesData(data) {
  const requiredFields = ['sku', 'date', 'qty', 'unit_price'];
  const validatedData = [];
  const errors = [];
  
  data.forEach((row, index) => {
    const rowErrors = [];
    const normalizedRow = {};
    
    // Check required fields
    requiredFields.forEach(field => {
      const value = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()];
      if (!value) {
        rowErrors.push(`Missing required field: ${field}`);
      } else {
        normalizedRow[field] = value;
      }
    });
    
    // Validate and convert data types
    if (normalizedRow.qty) {
      const qty = parseInt(normalizedRow.qty);
      if (isNaN(qty) || qty <= 0) {
        rowErrors.push('Quantity must be a positive number');
      } else {
        normalizedRow.qty = qty;
      }
    }
    
    if (normalizedRow.unit_price) {
      const price = parseFloat(normalizedRow.unit_price);
      if (isNaN(price) || price < 0) {
        rowErrors.push('Unit price must be a non-negative number');
      } else {
        normalizedRow.unit_price = price;
      }
    }
    
    if (normalizedRow.date) {
      const date = new Date(normalizedRow.date);
      if (isNaN(date.getTime())) {
        rowErrors.push('Invalid date format');
      } else {
        normalizedRow.date = date.toISOString().split('T')[0];
      }
    }
    
    // Add order_id if present
    if (row.order_id) {
      normalizedRow.order_id = row.order_id;
    }
    
    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors }); // +2 for 1-based index and header row
    } else {
      validatedData.push(normalizedRow);
    }
  });
  
  return { validatedData, errors };
}

/**
 * @route POST /api/upload/sales
 * @desc Upload and process sales data from CSV/Excel file
 * @access Private
 */
router.post('/sales', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let rawData;
    
    try {
      // Parse file based on extension
      if (fileExtension === '.csv') {
        rawData = await parseCsvFile(filePath);
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        rawData = await parseExcelFile(filePath);
      } else {
        throw new Error('Unsupported file format');
      }
      
      req.logger.info(`Parsed ${rawData.length} rows from ${req.file.originalname}`);
      
    } catch (parseError) {
      req.logger.error('File parsing error:', parseError);
      return res.status(400).json({ error: 'Failed to parse file: ' + parseError.message });
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Validate data
    const { validatedData, errors } = validateSalesData(rawData);
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Data validation failed',
        validation_errors: errors.slice(0, 10), // Limit to first 10 errors
        total_errors: errors.length
      });
    }
    
    if (validatedData.length === 0) {
      return res.status(400).json({ error: 'No valid data found in file' });
    }
    
    // Check if all SKUs exist in inventory
    const skus = [...new Set(validatedData.map(row => row.sku))];
    const existingItems = await req.db('inventory_items')
      .whereIn('sku', skus)
      .select('sku');
    
    const existingSkus = new Set(existingItems.map(item => item.sku));
    const missingSKUs = skus.filter(sku => !existingSkus.has(sku));
    
    if (missingSKUs.length > 0) {
      return res.status(400).json({
        error: 'Some SKUs do not exist in inventory',
        missing_skus: missingSKUs
      });
    }
    
    // Insert sales data
    const insertedSales = await req.db('sales').insert(validatedData).returning('*');
    
    req.logger.info(`Inserted ${insertedSales.length} sales records`);
    
    // Emit socket event
    req.io.emit('inventory_update', {
      type: 'sales_uploaded',
      data: {
        count: insertedSales.length,
        skus: skus
      }
    });
    
    // Trigger ML service to update forecasts for affected SKUs
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml_service:8000';
      
      // Trigger forecast update for each unique SKU (fire and forget)
      skus.forEach(async (sku) => {
        try {
          await axios.post(`${mlServiceUrl}/train`, { sku }, { timeout: 5000 });
        } catch (mlError) {
          req.logger.warn(`Failed to trigger ML training for SKU ${sku}:`, mlError.message);
        }
      });
      
    } catch (mlError) {
      req.logger.warn('Failed to communicate with ML service:', mlError.message);
    }
    
    res.json({
      success: true,
      message: 'Sales data uploaded successfully',
      data: {
        processed_rows: insertedSales.length,
        affected_skus: skus,
        file_name: req.file.originalname
      }
    });
    
  } catch (error) {
    req.logger.error('Sales upload error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to process sales upload' });
  }
});

/**
 * @route GET /api/upload/template
 * @desc Download CSV template for sales data upload
 * @access Public
 */
router.get('/template', (req, res) => {
  const template = 'order_id,sku,date,qty,unit_price\n' +
                  'ORD-001,WIDGET-001,2023-01-01,10,15.99\n' +
                  'ORD-002,GADGET-002,2023-01-02,5,29.99';
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales_template.csv"');
  res.send(template);
});

/**
 * Error handling middleware for multer
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

export default router;