import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { 
  Home, 
  Package, 
  Upload, 
  Bell, 
  Menu, 
  X, 
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import NotificationPanel from './NotificationPanel'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false)
  const { user, logout, isAuthenticated } = useAuth()
  const { isConnected, notifications } = useSocket()

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Items', href: '/items', icon: Package },
    { name: 'Upload Sales', href: '/upload', icon: Upload },
  ]

  const unreadCount = notifications.length

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Smart Inventory</h1>
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            )
          })}
        </nav>

        {/* Connection Status */}
        <div className="absolute bottom-4 left-6 right-6">
          <div className={`flex items-center text-xs ${
            isConnected ? 'text-green-600' : 'text-red-600'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Real-time connected
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 mr-2" />
                Disconnected
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-4 ml-auto">
              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md relative"
                  onClick={() => setNotificationsPanelOpen(!notificationsPanelOpen)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notification Panel */}
                {notificationsPanelOpen && (
                  <NotificationPanel
                    isOpen={notificationsPanelOpen}
                    onClose={() => setNotificationsPanelOpen(false)}
                    notifications={notifications}
                  />
                )}
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.username}</div>
                  <div className="text-gray-500">{user?.email}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}