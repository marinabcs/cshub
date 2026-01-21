import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { LoadingPage } from './components/UI/Loading'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Configuracoes from './pages/Configuracoes'
import Analytics from './pages/Analytics'
import Alertas from './pages/Alertas'
import ClienteForm from './pages/ClienteForm'
import Usuarios from './pages/Usuarios'
import Auditoria from './pages/Auditoria'

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingPage />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingPage />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/novo" element={<ClienteForm />} />
        <Route path="/clientes/:id" element={<ClienteDetalhe />} />
        <Route path="/clientes/:id/editar" element={<ClienteForm />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/configuracoes/usuarios" element={<Usuarios />} />
        <Route path="/configuracoes/auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
