import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../services/firebase';
import { registrarSessionTimeout } from '../services/auditService';

// Tempo de inatividade antes do logout (em minutos)
const INACTIVITY_TIMEOUT_MINUTES = 60; // 1 hora
// Tempo de aviso antes do logout (em segundos)
const WARNING_SECONDS = 60;

/**
 * Hook para auto-logout após período de inatividade
 *
 * Monitora: mouse, teclado, cliques, scroll, touch
 * Após 1h de inatividade: exibe aviso de 60s
 * Sem resposta: faz logout automático
 */
export function useSessionTimeout() {
  const { logout, isAuthenticated } = useAuth();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_SECONDS);
  const countdownRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async (isTimeout = false) => {
    clearAllTimers();
    setShowWarning(false);
    try {
      // Registrar session timeout antes do logout
      if (isTimeout) {
        await registrarSessionTimeout(db, auth).catch(() => {});
      }
      await logout();
    } catch (_error) {
      // Silently fail - user will be redirected to login anyway
    }
  }, [logout, clearAllTimers]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsRemaining(WARNING_SECONDS);

    // Countdown visual
    countdownRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Logout após WARNING_SECONDS (por timeout)
    warningTimeoutRef.current = setTimeout(() => {
      handleLogout(true); // true = é timeout
    }, WARNING_SECONDS * 1000);
  }, [handleLogout]);

  const resetTimer = useCallback(() => {
    // Se o warning está visível, usuário interagiu - cancelar logout
    if (showWarning) {
      setShowWarning(false);
      setSecondsRemaining(WARNING_SECONDS);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }

    // Reiniciar timer de inatividade
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
  }, [showWarning, startWarningCountdown]);

  // Função para manter sessão ativa (chamada pelo botão do modal)
  const keepAlive = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowWarning(false);
      return;
    }

    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle para não resetar timer a cada pixel de movimento
    let lastActivity = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastActivity > 5000) { // Máximo 1 reset a cada 5 segundos
        lastActivity = now;
        resetTimer();
      }
    };

    // Adicionar listeners
    events.forEach(event => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Iniciar timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledReset);
      });
      clearAllTimers();
    };
  }, [isAuthenticated, resetTimer, clearAllTimers]);

  return {
    showWarning,
    secondsRemaining,
    keepAlive,
    logout: handleLogout
  };
}
