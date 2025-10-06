import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  Package,
  Search,
  Filter,
  Plus,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import AddItemModal from '../components/AddItemModal'

export default function Items() {
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [categories, setCategories] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  useEffect(() => {
    loadItems()
    loadCategories()
  }, [])

  useEffect(() => {
    filterItems()
  }, [items, searchTerm, categoryFilter, stockFilter])

  const loadItems = async () => {
    try {
      const response = await axios.get('/api/items')
      setItems(response.data.data || [])
    } catch (error) {
      console.error('Failed to load items:', error)
      toast.error('Failed to load inventory items')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await axios.get('/api/items/categories/list')
      setCategories(response.data.data || [])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const filterItems = () => {
    let filtered = items

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    // Stock filter
    if (stockFilter === 'low') {
      filtered = filtered.filter(item => item.current_stock <= item.reorder_point)
    } else if (stockFilter === 'out') {
      filtered = filtered.filter(item => item.current_stock === 0)
    } else if (stockFilter === 'normal') {
      filtered = filtered.filter(item => item.current_stock > item.reorder_point)
    }

    setFilteredItems(filtered)
  }

  const getStockStatus = (item) => {
    if (item.current_stock === 0) {
      return { status: 'out', label: 'Out of Stock', color: 'text-red-600 bg-red-100' }
    } else if (item.current_stock <= item.reorder_point) {
      return { status: 'low', label: 'Low Stock', color: 'text-yellow-600 bg-yellow-100' }
    } else {
      return { status: 'normal', label: 'In Stock', color: 'text-green-600 bg-green-100' }
    }
  }

  const getStockTrend = (item) => {
    // This would normally be based on historical data
    // For demo purposes, we'll use a simple heuristic
    const stockRatio = item.current_stock / (item.reorder_point || 1)
    
    if (stockRatio < 0.5) {
      return { trend: 'down', icon: TrendingDown, color: 'text-red-500' }
    } else if (stockRatio > 2) {
      return { trend: 'up', icon: TrendingUp, color: 'text-green-500' }
    } else {
      return { trend: 'stable', icon: TrendingUp, color: 'text-gray-400' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="spinner" />
          <span>Loading inventory items...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Items</h1>
          <p className="text-gray-600">
            Manage your inventory items and monitor stock levels
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadItems}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="form-label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="form-label">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div>
            <label className="form-label">Stock Status</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Items</option>
              <option value="normal">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Items</p>
                <p className="text-2xl font-bold text-blue-900">{items.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">In Stock</p>
                <p className="text-2xl font-bold text-green-900">
                  {items.filter(item => item.current_stock > item.reorder_point).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-600">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {items.filter(item => item.current_stock <= item.reorder_point && item.current_stock > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-900">
                  {items.filter(item => item.current_stock === 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Items ({filteredItems.length})
          </h3>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first inventory item'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Reorder Point</th>
                  <th>Status</th>
                  <th>Supplier</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item)
                  const stockTrend = getStockTrend(item)
                  const TrendIcon = stockTrend.icon

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            ${item.cost_price?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{item.sku}</td>
                      <td>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          {item.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center">
                          <span className="font-medium">{item.current_stock}</span>
                          <TrendIcon className={`ml-2 h-4 w-4 ${stockTrend.color}`} />
                        </div>
                      </td>
                      <td>{item.reorder_point}</td>
                      <td>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td>
                        {item.supplier_name ? (
                          <div>
                            <p className="text-sm font-medium">{item.supplier_name}</p>
                            <p className="text-xs text-gray-500">
                              {item.supplier_lead_time || item.lead_time_days} days lead time
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No supplier</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/items/${item.sku}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/items/${item.sku}`}
                            className="text-gray-400 hover:text-gray-600"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadItems()
          loadCategories()
        }}
      />
    </div>
  )
}