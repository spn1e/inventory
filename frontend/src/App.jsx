import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import io from 'socket.io-client'

// Import components
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import UploadSales from './pages/UploadSales'
import ItemDetail from './pages/ItemDetail'
import Items from './pages/Items'
import Login from './pages/Login'

// Import context providers
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="items" element={<Items />} />
              <Route path="items/:sku" element={<ItemDetail />} />
              <Route path="upload" element={<UploadSales />} />
            </Route>
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
        </div>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App