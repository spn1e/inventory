import { useEffect, useRef } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '../contexts/SocketContext'

const notificationIcons = {
  inventory_update: CheckCircle,
  forecast_ready: Info,
  alert: AlertTriangle,
  error: AlertCircle
}

const notificationColors = {
  inventory_update: 'text-green-500',
  forecast_ready: 'text-blue-500',
  alert: 'text-yellow-500',
  error: 'text-red-500'
}

export default function NotificationPanel({ isOpen, onClose, notifications }) {
  const panelRef = useRef(null)
  const { clearNotification, clearAllNotifications } = useSocket()

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-w-sm z-50">
      <div
        ref={panelRef}
        className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Notifications
            {notifications.length > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {notifications.length}
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-2">
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Info
                const iconColor = notificationColors[notification.type] || 'text-gray-500'
                
                return (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </p>
                        {notification.data && (
                          <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                            {JSON.stringify(notification.data, null, 2).slice(0, 200)}
                            {JSON.stringify(notification.data).length > 200 && '...'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => clearNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}