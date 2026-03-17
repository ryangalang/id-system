import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import PrintPage from './pages/Print'
import ImportCSV from './pages/Import'
import { useState } from 'react'

function AppShell() {
  const { user, loading } = useAuth()
  const [printQueue, setPrintQueue] = useState([])
  const navigate = useNavigate()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--gray-50)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  const handlePrintSelected = (employees) => {
    setPrintQueue(employees)
    navigate('/print')
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/employees"
            element={<Employees onPrintSelected={handlePrintSelected} />}
          />
          <Route
            path="/print"
            element={
              <PrintPage
                preselected={printQueue}
                onClearPreselected={() => setPrintQueue([])}
              />
            }
          />
          <Route path="/import" element={<ImportCSV />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
