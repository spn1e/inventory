import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer
} from 'recharts'
import {
  ArrowLeft,
  Package,
  TrendingUp,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Brain,
  ShoppingCart,
  Building,
  Clock,
  DollarSign
} from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'
import toast from 'react-hot-toast'

export default function ItemDetail() {
  const { sku } = useParams()
  const [item, setItem] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [salesHistory, setSalesHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(90)

  useEffect(() => {
    if (sku) {
      loadItemData()
    }
  }, [sku, selectedPeriod])

  const loadItemData = async () => {
    setLoading(true)
    try {
      const [itemRes, salesRes, forecastRes] = await Promise.all([
        axios.get(`/api/items/${sku}`),
        axios.get(`/api/sales/${sku}/history?days=${selectedPeriod}`),
        axios.get(`/api/forecast/${sku}/latest?days=30`).catch(() => ({ data: { data: null } }))
      ])

      setItem(itemRes.data.data)
      setSalesHistory(salesRes.data.data)
      setForecast(forecastRes.data.data)
    } catch (error) {
      console.error('Failed to load item data:', error)
      toast.error('Failed to load item details')
    } finally {
      setLoading(false)
    }
  }

  const generateForecast = async () => {
    setForecastLoading(true)
    try {
      const response = await axios.post('/api/forecast/predict', {
        sku: sku,
        horizon_days: 30
      })
      
      setForecast(response.data.data)
      toast.success('Forecast generated successfully')
    } catch (error) {
      console.error('Failed to generate forecast:', error)
      const message = error.response?.data?.error || 'Failed to generate forecast'
      toast.error(message)
    } finally {
      setForecastLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="spinner" />
          <span>Loading item details...</span>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Item not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The requested SKU could not be found.
        </p>
        <Link to="/items" className="mt-4 btn-primary inline-flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Items
        </Link>
      </div>
    )
  }

  // Prepare chart data
  const combinedChartData = []
  const maxDataPoints = 60 // Show last 60 days

  // Create date range for the chart
  const endDate = new Date()
  const startDate = subDays(endDate, maxDataPoints)
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = format(d, 'yyyy-MM-dd')
    
    // Find sales data for this date
    const salesForDate = salesHistory?.daily_aggregation?.find(
      sale => sale.date === dateStr
    )
    
    // Find forecast data for this date
    const forecastForDate = forecast?.forecasts?.find(
      f => f.date === dateStr
    )
    
    combinedChartData.push({
      date: format(d, 'MMM dd'),
      actualSales: salesForDate?.total_qty || 0,
      forecastSales: forecastForDate?.forecast_qty || null,
      forecastLower: forecastForDate?.confidence_lower || null,
      forecastUpper: forecastForDate?.confidence_upper || null
    })
  }

  const getStockStatus = () => {
    if (item.current_stock === 0) {
      return { status: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
    } else if (item.current_stock <= item.reorder_point) {
      return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle }
    } else {
      return { status: 'In Stock', color: 'bg-green-100 text-green-800', icon: Package }
    }
  }

  const stockStatus = getStockStatus()
  const StatusIcon = stockStatus.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/items"
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-gray-600">SKU: {item.sku}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="form-input w-32"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
          </select>
          <button
            onClick={loadItemData}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Item Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <StatusIcon className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Stock Status</p>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}>
                {stockStatus.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Current Stock</p>
              <p className="text-2xl font-bold text-gray-900">{item.current_stock}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Reorder Point</p>
              <p className="text-2xl font-bold text-gray-900">{item.reorder_point}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unit Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${item.cost_price?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Item Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">General</h4>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-gray-500">Category</dt>
                  <dd className="text-sm font-medium">
                    {item.category || 'Uncategorized'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Safety Stock</dt>
                  <dd className="text-sm font-medium">{item.safety_stock}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Reorder Quantity</dt>
                  <dd className="text-sm font-medium">{item.reorder_qty}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Auto Reorder</dt>
                  <dd className="text-sm font-medium">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.auto_reorder 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.auto_reorder ? 'Enabled' : 'Disabled'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Supplier</h4>
              {item.supplier_name ? (
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-gray-500">Supplier Name</dt>
                    <dd className="text-sm font-medium">{item.supplier_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Lead Time</dt>
                    <dd className="text-sm font-medium">
                      {item.supplier_lead_time || item.lead_time_days} days
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Min Order Qty</dt>
                    <dd className="text-sm font-medium">
                      {item.supplier_min_order_qty || 'N/A'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">No supplier assigned</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full btn-primary flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Create Purchase Order
            </button>
            <button className="w-full btn-secondary flex items-center justify-center">
              <Package className="h-4 w-4 mr-2" />
              Update Stock
            </button>
            <button className="w-full btn-secondary flex items-center justify-center">
              <Building className="h-4 w-4 mr-2" />
              View Supplier Details
            </button>
          </div>
        </div>
      </div>

      {/* Forecast Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-purple-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Demand Forecast</h3>
              <p className="text-sm text-gray-500">
                {forecast 
                  ? `Last updated: ${format(parseISO(forecast.last_updated), 'MMM dd, yyyy')}`
                  : 'No forecast available'
                }
              </p>
            </div>
          </div>
          <button
            onClick={generateForecast}
            disabled={forecastLoading}
            className="btn-primary flex items-center"
          >
            {forecastLoading ? (
              <>
                <div className="spinner mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate Forecast
              </>
            )}
          </button>
        </div>

        {forecast?.forecasts?.length > 0 ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="actualSales"
                  fill="#3B82F6"
                  name="Actual Sales"
                  opacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="forecastSales"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Forecast"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecastLower"
                  stroke="#10B981"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Lower Bound"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecastUpper"
                  stroke="#10B981"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Upper Bound"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {forecast.model_metrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Mean Absolute Error</p>
                  <p className="text-lg font-semibold">
                    {forecast.model_metrics.mae?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">MAPE</p>
                  <p className="text-lg font-semibold">
                    {forecast.model_metrics.mape?.toFixed(1) || 'N/A'}%
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">R²</p>
                  <p className="text-lg font-semibold">
                    {forecast.model_metrics.r2?.toFixed(3) || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Accuracy</p>
                  <p className="text-lg font-semibold">
                    {forecast.model_metrics.accuracy_category || 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-lg font-medium text-gray-900">No forecast available</h4>
            <p className="mt-1 text-sm text-gray-500">
              {forecast?.needs_training 
                ? 'Insufficient sales data for forecasting. At least 10 sales records are required.'
                : 'Click "Generate Forecast" to create a demand prediction for this item.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Sales History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Sales History</h3>
        
        {salesHistory?.statistics && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-600">Total Sold</p>
              <p className="text-2xl font-bold text-blue-900">
                {salesHistory.statistics.total_sold}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-600">Avg per Transaction</p>
              <p className="text-2xl font-bold text-green-900">
                {salesHistory.statistics.avg_qty_per_transaction.toFixed(1)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-600">Avg Price</p>
              <p className="text-2xl font-bold text-purple-900">
                ${salesHistory.statistics.avg_unit_price.toFixed(2)}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-600">Transactions</p>
              <p className="text-2xl font-bold text-yellow-900">
                {salesHistory.statistics.total_transactions}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-red-600">Peak Qty</p>
              <p className="text-2xl font-bold text-red-900">
                {salesHistory.statistics.max_qty}
              </p>
            </div>
          </div>
        )}

        {salesHistory?.daily_aggregation?.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesHistory.daily_aggregation.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(parseISO(date), 'MM/dd')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => format(parseISO(date), 'MMM dd, yyyy')}
              />
              <Bar dataKey="total_qty" fill="#3B82F6" name="Quantity Sold" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-lg font-medium text-gray-900">No sales history</h4>
            <p className="mt-1 text-sm text-gray-500">
              No sales data found for the selected period.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}