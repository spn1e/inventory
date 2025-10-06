import { useState, useEffect } from 'react'
import { X, Package, DollarSign, Hash, Tag, TrendingDown, Clock, Shield, Truck } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function AddItemModal({ isOpen, onClose, onSuccess }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    cost_price: '',
    reorder_point: '',
    reorder_qty: '',
    lead_time_days: '',
    safety_stock: '',
    current_stock: '',
    supplier_id: '',
    auto_reorder: false
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadSuppliers()
    }
  }, [isOpen])

  const loadSuppliers = async () => {
    try {
      const response = await axios.get('/api/suppliers')
      setSuppliers(response.data.data || [])
    } catch (error) {
      console.error('Failed to load suppliers:', error)
      // Suppliers endpoint doesn't exist, set empty array
      setSuppliers([])
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.sku || formData.sku.trim() === '') {
      newErrors.sku = 'SKU is required'
    }
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required'
    }
    if (formData.cost_price && (isNaN(formData.cost_price) || parseFloat(formData.cost_price) < 0)) {
      newErrors.cost_price = 'Cost price must be a positive number'
    }
    if (formData.reorder_point && (isNaN(formData.reorder_point) || parseInt(formData.reorder_point) < 0)) {
      newErrors.reorder_point = 'Reorder point must be a positive integer'
    }
    if (formData.reorder_qty && (isNaN(formData.reorder_qty) || parseInt(formData.reorder_qty) < 1)) {
      newErrors.reorder_qty = 'Reorder quantity must be at least 1'
    }
    if (formData.lead_time_days && (isNaN(formData.lead_time_days) || parseInt(formData.lead_time_days) < 1)) {
      newErrors.lead_time_days = 'Lead time must be at least 1 day'
    }
    if (formData.safety_stock && (isNaN(formData.safety_stock) || parseInt(formData.safety_stock) < 0)) {
      newErrors.safety_stock = 'Safety stock must be a positive integer'
    }
    if (formData.current_stock && (isNaN(formData.current_stock) || parseInt(formData.current_stock) < 0)) {
      newErrors.current_stock = 'Current stock must be a positive integer'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }

    setLoading(true)

    try {
      // Prepare data for submission
      const submitData = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        auto_reorder: formData.auto_reorder
      }

      // Only include optional fields if they have values
      if (formData.category && formData.category.trim()) {
        submitData.category = formData.category.trim()
      }
      if (formData.cost_price && formData.cost_price !== '') {
        submitData.cost_price = parseFloat(formData.cost_price)
      }
      if (formData.reorder_point && formData.reorder_point !== '') {
        submitData.reorder_point = parseInt(formData.reorder_point)
      }
      if (formData.reorder_qty && formData.reorder_qty !== '') {
        submitData.reorder_qty = parseInt(formData.reorder_qty)
      }
      if (formData.lead_time_days && formData.lead_time_days !== '') {
        submitData.lead_time_days = parseInt(formData.lead_time_days)
      }
      if (formData.safety_stock && formData.safety_stock !== '') {
        submitData.safety_stock = parseInt(formData.safety_stock)
      }
      if (formData.current_stock && formData.current_stock !== '') {
        submitData.current_stock = parseInt(formData.current_stock)
      }
      if (formData.supplier_id && formData.supplier_id !== '') {
        submitData.supplier_id = formData.supplier_id
      }

      await axios.post('/api/items', submitData)

      toast.success('Item added successfully!')

      // Reset form
      setFormData({
        sku: '',
        name: '',
        category: '',
        cost_price: '',
        reorder_point: '',
        reorder_qty: '',
        lead_time_days: '',
        safety_stock: '',
        current_stock: '',
        supplier_id: '',
        auto_reorder: false
      })
      setErrors({})

      // Call success callback and close modal
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to add item:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add item'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-6 w-6 text-white mr-3" />
              <h3 className="text-lg font-medium text-white">Add New Item</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <label className="form-label flex items-center">
                  <Hash className="h-4 w-4 mr-1" />
                  SKU <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className={`form-input ${errors.sku ? 'border-red-500' : ''}`}
                  placeholder="e.g., PROD-001"
                  required
                />
                {errors.sku && (
                  <p className="text-red-500 text-sm mt-1">{errors.sku}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="form-label flex items-center">
                  <Package className="h-4 w-4 mr-1" />
                  Name <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`form-input ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="e.g., Widget A"
                  required
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="form-label flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  Category
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g., Electronics"
                />
              </div>

              {/* Cost Price */}
              <div>
                <label className="form-label flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Cost Price
                </label>
                <input
                  type="number"
                  name="cost_price"
                  value={formData.cost_price}
                  onChange={handleChange}
                  className={`form-input ${errors.cost_price ? 'border-red-500' : ''}`}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {errors.cost_price && (
                  <p className="text-red-500 text-sm mt-1">{errors.cost_price}</p>
                )}
              </div>

              {/* Current Stock */}
              <div>
                <label className="form-label flex items-center">
                  <Package className="h-4 w-4 mr-1" />
                  Current Stock
                </label>
                <input
                  type="number"
                  name="current_stock"
                  value={formData.current_stock}
                  onChange={handleChange}
                  className={`form-input ${errors.current_stock ? 'border-red-500' : ''}`}
                  placeholder="0"
                  min="0"
                />
                {errors.current_stock && (
                  <p className="text-red-500 text-sm mt-1">{errors.current_stock}</p>
                )}
              </div>

              {/* Reorder Point */}
              <div>
                <label className="form-label flex items-center">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Reorder Point
                </label>
                <input
                  type="number"
                  name="reorder_point"
                  value={formData.reorder_point}
                  onChange={handleChange}
                  className={`form-input ${errors.reorder_point ? 'border-red-500' : ''}`}
                  placeholder="0"
                  min="0"
                />
                {errors.reorder_point && (
                  <p className="text-red-500 text-sm mt-1">{errors.reorder_point}</p>
                )}
              </div>

              {/* Reorder Quantity */}
              <div>
                <label className="form-label flex items-center">
                  <Package className="h-4 w-4 mr-1" />
                  Reorder Quantity
                </label>
                <input
                  type="number"
                  name="reorder_qty"
                  value={formData.reorder_qty}
                  onChange={handleChange}
                  className={`form-input ${errors.reorder_qty ? 'border-red-500' : ''}`}
                  placeholder="0"
                  min="1"
                />
                {errors.reorder_qty && (
                  <p className="text-red-500 text-sm mt-1">{errors.reorder_qty}</p>
                )}
              </div>

              {/* Safety Stock */}
              <div>
                <label className="form-label flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Safety Stock
                </label>
                <input
                  type="number"
                  name="safety_stock"
                  value={formData.safety_stock}
                  onChange={handleChange}
                  className={`form-input ${errors.safety_stock ? 'border-red-500' : ''}`}
                  placeholder="0"
                  min="0"
                />
                {errors.safety_stock && (
                  <p className="text-red-500 text-sm mt-1">{errors.safety_stock}</p>
                )}
              </div>

              {/* Lead Time Days */}
              <div>
                <label className="form-label flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  name="lead_time_days"
                  value={formData.lead_time_days}
                  onChange={handleChange}
                  className={`form-input ${errors.lead_time_days ? 'border-red-500' : ''}`}
                  placeholder="0"
                  min="1"
                />
                {errors.lead_time_days && (
                  <p className="text-red-500 text-sm mt-1">{errors.lead_time_days}</p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label className="form-label flex items-center">
                  <Truck className="h-4 w-4 mr-1" />
                  Supplier
                </label>
                <select
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="">No supplier</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto Reorder Checkbox */}
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="auto_reorder"
                  checked={formData.auto_reorder}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Enable automatic reordering
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end space-x-3 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
