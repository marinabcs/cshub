import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { LoadingPage } from './components/UI/Loading'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from './services/firebase'
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
import DebugFirestore from './pages/DebugFirestore'
import Playbooks from './pages/Playbooks'
import PlaybookDetalhe from './pages/PlaybookDetalhe'
import MinhaCarteira from './pages/MinhaCarteira'
import Documentos from './pages/Documentos'

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

// Rota protegida apenas para admins
function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(null)
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.email) {
        setIsAdmin(false)
        setCheckingRole(false)
        return
      }

      try {
        const q = query(
          collection(db, 'usuarios_sistema'),
          where('email', '==', user.email)
        )
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data()
          setIsAdmin(userData.role === 'admin' || userData.role === 'super_admin')
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error('Erro ao verificar role:', error)
        setIsAdmin(false)
      } finally {
        setCheckingRole(false)
      }
    }

    if (isAuthenticated) {
      checkAdminRole()
    } else {
      setCheckingRole(false)
    }
  }, [user?.email, isAuthenticated])

  if (loading || checkingRole) {
    return <LoadingPage />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
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
        <Route path="/minha-carteira" element={<MinhaCarteira />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/novo" element={<ClienteForm />} />
        <Route path="/clientes/:id" element={<ClienteDetalhe />} />
        <Route path="/clientes/:id/editar" element={<ClienteForm />} />
        <Route path="/playbooks" element={<Playbooks />} />
        <Route path="/playbooks/:id" element={<PlaybookDetalhe />} />
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/configuracoes/usuarios" element={<Usuarios />} />
        <Route path="/configuracoes/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
        {/* Debug page - apenas em desenvolvimento */}
        {import.meta.env.DEV && (
          <Route path="/debug" element={<DebugFirestore />} />
        )}
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
