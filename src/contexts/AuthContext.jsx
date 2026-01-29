import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '../services/firebase'

const AuthContext = createContext(null)

// Constantes para controle de sessão
const SESSION_KEY = 'cshub_session_start'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias em milissegundos

// Verifica se a sessão expirou
function isSessionExpired() {
  const sessionStart = localStorage.getItem(SESSION_KEY)
  if (!sessionStart) return false // Se não tem sessão, deixa o Firebase decidir

  const sessionAge = Date.now() - parseInt(sessionStart, 10)
  return sessionAge > SESSION_DURATION_MS
}

// Salva o início da sessão
function saveSessionStart() {
  localStorage.setItem(SESSION_KEY, Date.now().toString())
}

// Remove a sessão
function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email?.endsWith('@trakto.io')) {
        // Verificar se a sessão expirou (mais de 7 dias)
        if (isSessionExpired()) {
          console.log('Sessão expirada após 7 dias. Fazendo logout...')
          await signOut(auth)
          clearSession()
          setUser(null)
        } else {
          // Se não tem timestamp de sessão, criar agora (usuário já logado)
          if (!localStorage.getItem(SESSION_KEY)) {
            saveSessionStart()
          }
          setUser(user)
        }
      } else {
        clearSession()
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function login(email, password) {
    if (!email.endsWith('@trakto.io')) {
      throw new Error('Apenas emails @trakto.io podem acessar o sistema.')
    }
    const result = await signInWithEmailAndPassword(auth, email, password)
    // Salvar timestamp de início da sessão para logout automático em 7 dias
    saveSessionStart()
    return result.user
  }

  async function logout() {
    await signOut(auth)
    clearSession()
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
