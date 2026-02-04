import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { LoadingPage } from './components/UI/Loading'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from './services/firebase'

// Eager — páginas críticas (primeiro load)
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Lazy — carregamento sob demanda
const Clientes = lazy(() => import('./pages/Clientes'))
const ClienteDetalhe = lazy(() => import('./pages/ClienteDetalhe'))
const ClienteForm = lazy(() => import('./pages/ClienteForm'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Alertas = lazy(() => import('./pages/Alertas'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Playbooks = lazy(() => import('./pages/Playbooks'))
const PlaybookDetalhe = lazy(() => import('./pages/PlaybookDetalhe'))
const PlaybookForm = lazy(() => import('./pages/PlaybookForm'))
const MinhaCarteira = lazy(() => import('./pages/MinhaCarteira'))
const Documentos = lazy(() => import('./pages/Documentos'))
const ResumoExecutivo = lazy(() => import('./pages/ResumoExecutivo'))
const OnboardingCalculadora = lazy(() => import('./pages/OnboardingCalculadora'))

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

function DevDebugPage() {
  const DebugFirestore = lazy(() => import('./pages/DebugFirestore'))
  return <DebugFirestore />
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
        <Route path="/playbooks/novo" element={<PlaybookForm />} />
        <Route path="/playbooks/:id" element={<PlaybookDetalhe />} />
        <Route path="/playbooks/:id/editar" element={<PlaybookForm />} />
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/resumo-executivo" element={<ResumoExecutivo />} />
        <Route path="/onboarding" element={<OnboardingCalculadora />} />
        <Route path="/onboarding/:clienteId" element={<OnboardingCalculadora />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/configuracoes/usuarios" element={<Usuarios />} />
        <Route path="/configuracoes/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
        {/* Debug page - excluída do bundle de produção */}
        {import.meta.env.DEV && (
          <Route path="/debug" element={<DevDebugPage />} />
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
        <Suspense fallback={<LoadingPage />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
