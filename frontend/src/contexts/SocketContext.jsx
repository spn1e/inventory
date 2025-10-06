import { createContext, useContext, useEffect, useState } from 'react'
import io from 'socket.io-client'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const SocketContext = createContext({})

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState([])
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Create socket connection
    const newSocket = io(WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5
    })

    setSocket(newSocket)

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setIsConnected(true)
      toast.success('Real-time updates connected')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        newSocket.connect()
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      toast.error('Failed to connect to real-time updates')
    })

    // Application event handlers
    newSocket.on('inventory_update', (data) => {
      console.log('Inventory update:', data)
      
      const message = getInventoryUpdateMessage(data)
      if (message) {
        toast.success(message)
        addNotification({
          id: Date.now(),
          type: 'inventory_update',
          message,
          data,
          timestamp: new Date()
        })
      }
    })

    newSocket.on('forecast_ready', (data) => {
      console.log('Forecast ready:', data)
      
      toast.success(`Forecast completed for ${data.sku}`)
      addNotification({
        id: Date.now(),
        type: 'forecast_ready',
        message: `New forecast available for ${data.sku} (${data.horizon_days} days)`,
        data,
        timestamp: new Date()
      })
    })

    newSocket.on('alert_created', (data) => {
      console.log('Alert created:', data)
      
      const message = getAlertMessage(data)
      toast.warning(message)
      addNotification({
        id: Date.now(),
        type: 'alert',
        message,
        data,
        timestamp: new Date()
      })
    })

    return () => {
      newSocket.close()
    }
  }, [isAuthenticated])

  const getInventoryUpdateMessage = (data) => {
    switch (data.type) {
      case 'item_created':
        return `New item added: ${data.data.name} (${data.data.sku})`
      case 'item_updated':
        return `Item updated: ${data.data.name} (${data.data.sku})`
      case 'item_deleted':
        return `Item deleted: ${data.data.sku}`
      case 'sales_uploaded':
        return `Sales data uploaded: ${data.data.count} records for ${data.data.skus.length} items`
      case 'purchase_order_created':
        return `Purchase order created for ${data.data.qty} units`
      default:
        return 'Inventory updated'
    }
  }

  const getAlertMessage = (data) => {
    switch (data.type) {
      case 'reorder_required':
        return `${data.count} items need reordering`
      case 'low_stock':
        return `Low stock alert for ${data.sku || 'multiple items'}`
      case 'forecast_complete':
        return `Forecast completed for ${data.sku}`
      default:
        return 'New alert created'
    }
  }

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 49)]) // Keep last 50
  }

  const clearNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  const joinRoom = (roomName) => {
    if (socket && isConnected) {
      socket.emit('join_room', roomName)
      console.log(`Joined room: ${roomName}`)
    }
  }

  const leaveRoom = (roomName) => {
    if (socket && isConnected) {
      socket.emit('leave_room', roomName)
      console.log(`Left room: ${roomName}`)
    }
  }

  const value = {
    socket,
    isConnected,
    notifications,
    clearNotification,
    clearAllNotifications,
    joinRoom,
    leaveRoom
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export default SocketContext