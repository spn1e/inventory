import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import {
  Upload,
  File,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  FileSpreadsheet
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function UploadSales() {
  const [uploadState, setUploadState] = useState('idle') // idle, uploading, success, error
  const [uploadResult, setUploadResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm()

  const selectedFile = watch('file')?.[0]

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (validateFile(file)) {
        setValue('file', e.dataTransfer.files)
      }
    }
  }

  const validateFile = (file) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error('Please select a CSV or Excel file')
      return false
    }
    
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB')
      return false
    }
    
    return true
  }

  const onSubmit = async (data) => {
    if (!data.file || !data.file[0]) {
      toast.error('Please select a file to upload')
      return
    }

    const file = data.file[0]
    if (!validateFile(file)) return

    setUploadState('uploading')
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/upload/sales', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 second timeout for uploads
      })

      setUploadState('success')
      setUploadResult(response.data.data)
      toast.success('Sales data uploaded successfully!')
      
      // Clear the form
      setValue('file', null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      setUploadState('error')
      const errorData = error.response?.data
      
      if (errorData?.validation_errors) {
        setUploadResult({
          error: errorData.error,
          validation_errors: errorData.validation_errors,
          total_errors: errorData.total_errors
        })
        toast.error(`Upload failed: ${errorData.total_errors} validation errors found`)
      } else if (errorData?.missing_skus) {
        setUploadResult({
          error: errorData.error,
          missing_skus: errorData.missing_skus
        })
        toast.error('Upload failed: Some SKUs do not exist in inventory')
      } else {
        const message = errorData?.error || 'Upload failed'
        setUploadResult({ error: message })
        toast.error(message)
      }
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await axios.get('/api/upload/template', {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'sales_template.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Template downloaded successfully')
    } catch (error) {
      toast.error('Failed to download template')
    }
  }

  const clearUpload = () => {
    setUploadState('idle')
    setUploadResult(null)
    setValue('file', null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Sales Data</h1>
        <p className="mt-2 text-gray-600">
          Upload your sales history in CSV or Excel format to update inventory and generate forecasts.
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* File Upload Area */}
          <div>
            <label className="form-label">Sales Data File</label>
            <div
              className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                dragActive
                  ? 'border-blue-400 bg-blue-50'
                  : selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-1 text-center">
                {selectedFile ? (
                  <>
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-green-500" />
                    <div className="flex text-sm text-gray-600">
                      <p className="font-medium">{selectedFile.name}</p>
                      <button
                        type="button"
                        onClick={clearUpload}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          ref={fileInputRef}
                          id="file-upload"
                          type="file"
                          className="sr-only"
                          accept=".csv,.xlsx,.xls"
                          {...register('file', {
                            required: 'Please select a file to upload'
                          })}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      CSV, XLSX or XLS up to 10MB
                    </p>
                  </>
                )}
              </div>
            </div>
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-secondary flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </button>

            <div className="flex items-center space-x-3">
              {uploadState !== 'idle' && (
                <button
                  type="button"
                  onClick={clearUpload}
                  className="btn-secondary"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={uploadState === 'uploading'}
                className="btn-primary flex items-center"
              >
                {uploadState === 'uploading' ? (
                  <>
                    <div className="spinner mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Sales Data
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Upload Results */}
      {uploadResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            {uploadState === 'success' ? (
              <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
            )}
            <h3 className="text-lg font-medium">
              {uploadState === 'success' ? 'Upload Successful' : 'Upload Failed'}
            </h3>
          </div>

          {uploadState === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-green-800">Records Processed</p>
                  <p className="text-2xl font-bold text-green-900">
                    {uploadResult.processed_rows}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">SKUs Affected</p>
                  <p className="text-2xl font-bold text-green-900">
                    {uploadResult.affected_skus?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">File Name</p>
                  <p className="text-sm text-green-700 truncate">
                    {uploadResult.file_name}
                  </p>
                </div>
              </div>
              {uploadResult.affected_skus && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-green-800 mb-2">Affected SKUs:</p>
                  <div className="flex flex-wrap gap-2">
                    {uploadResult.affected_skus.slice(0, 10).map(sku => (
                      <span
                        key={sku}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                      >
                        {sku}
                      </span>
                    ))}
                    {uploadResult.affected_skus.length > 10 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{uploadResult.affected_skus.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadState === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium mb-3">{uploadResult.error}</p>
              
              {uploadResult.validation_errors && (
                <div>
                  <p className="text-sm font-medium text-red-800 mb-2">
                    Validation Errors ({uploadResult.total_errors} total):
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {uploadResult.validation_errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700">
                        <span className="font-medium">Row {error.row}:</span>
                        <ul className="ml-4 list-disc">
                          {error.errors.map((err, errIndex) => (
                            <li key={errIndex}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadResult.missing_skus && (
                <div>
                  <p className="text-sm font-medium text-red-800 mb-2">Missing SKUs:</p>
                  <div className="flex flex-wrap gap-2">
                    {uploadResult.missing_skus.map(sku => (
                      <span
                        key={sku}
                        className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                      >
                        {sku}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">File Format Requirements</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Required columns:</strong> order_id, sku, date, qty, unit_price</p>
          <p><strong>Date format:</strong> YYYY-MM-DD (e.g., 2023-12-31)</p>
          <p><strong>File types:</strong> CSV, XLSX, or XLS</p>
          <p><strong>Max file size:</strong> 10MB</p>
          <p><strong>Note:</strong> All SKUs must already exist in your inventory before uploading sales data.</p>
        </div>
      </div>
    </div>
  )
}