import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts'
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useSocket } from '../contexts/SocketContext'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null)
  const [salesAnalytics, setSalesAnalytics] = useState(null)
  const [reorderSuggestions, setReorderSuggestions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const { isConnected } = useSocket()

  useEffect(() => {
    loadDashboardData()
  }, [selectedPeriod])

  const loadDashboardData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    if (!showRefresh) setLoading(true)

    try {
      const [itemsRes, analyticsRes, reorderRes] = await Promise.all([
        axios.get('/api/items'),
        axios.get(`/api/sales/analytics/summary?days=${selectedPeriod}`),
        axios.get('/api/reorder/suggestions')
      ])

      setDashboardData(itemsRes.data.data)
      setSalesAnalytics(analyticsRes.data.data)
      setReorderSuggestions(reorderRes.data.data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="spinner" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const lowStockItems = dashboardData?.filter(item => item.current_stock <= item.reorder_point) || []
  const totalValue = dashboardData?.reduce((sum, item) => sum + (item.current_stock * item.cost_price), 0) || 0

  // Prepare chart data
  const dailyTrendData = salesAnalytics?.daily_trend?.map(day => ({
    date: format(new Date(day.date), 'MMM dd'),
    quantity: day.quantity,
    revenue: day.revenue,
    transactions: day.transactions
  })).reverse() || []

  const categoryData = salesAnalytics?.category_breakdown?.map((cat, index) => ({
    name: cat.category || 'Uncategorized',
    value: cat.total_sold,
    revenue: cat.revenue,
    fill: COLORS[index % COLORS.length]
  })) || []

  const topProductsData = salesAnalytics?.top_products?.slice(0, 10).map(product => ({
    name: product.name || product.sku,
    sold: product.total_sold,
    revenue: product.revenue
  })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Overview of your inventory management system
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="form-input w-32"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          {/* Connection Status */}
          <div className={`flex items-center px-3 py-2 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isConnected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${totalValue.toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {lowStockItems.length}
              </p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Revenue ({selectedPeriod}d)
              </p>
              <p className="text-2xl font-bold text-gray-900">
                ${salesAnalytics?.summary?.total_revenue?.toFixed(0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="chart-container">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="quantity" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Quantity Sold"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="chart-container">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row - Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Products</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProductsData.slice(0, 5).map((product, index) => (
                  <tr key={index}>
                    <td className="font-medium">{product.name}</td>
                    <td>{product.sold}</td>
                    <td>${product.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reorder Suggestions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Reorder Suggestions</h3>
            {reorderSuggestions?.summary?.urgent_items > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                {reorderSuggestions.summary.urgent_items} urgent
              </span>
            )}
          </div>
          <div className="space-y-3">
            {reorderSuggestions?.suggestions?.slice(0, 5).map((suggestion, index) => (
              <div 
                key={suggestion.sku} 
                className={`p-3 rounded-lg border ${
                  suggestion.analytics?.urgency_score >= 7 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{suggestion.name}</p>
                    <p className="text-xs text-gray-500">{suggestion.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Order: {suggestion.recommended_order_qty}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current: {suggestion.current_stock}
                    </p>
                  </div>
                </div>
                {suggestion.analytics?.urgency_score >= 7 && (
                  <div className="mt-2 flex items-center text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    High priority - {suggestion.analytics.days_remaining} days remaining
                  </div>
                )}
              </div>
            ))}
            {(!reorderSuggestions?.suggestions || reorderSuggestions.suggestions.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">
                No reorder suggestions at this time
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}