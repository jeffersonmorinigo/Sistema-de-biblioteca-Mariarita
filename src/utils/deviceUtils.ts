import { useState, useEffect } from 'react';

/**
 * Detecta se o dispositivo atual é um smartphone/tablet (dispositivo móvel).
 * Garante que no PC Desktop ou no aplicativo Electron a câmera NÃO seja ativada.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Se for o aplicativo Electron do Windows, NUNCA é dispositivo móvel
  if (navigator.userAgent.includes('Electron')) {
    return false;
  }

  // 2. Detecta navegadores mobile (Android, iOS, iPadOS, etc.)
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  if (isMobileUA) {
    return true;
  }

  // 3. Detecta touch screen em telas pequenas/médias (modo mobile no navegador)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 820;

  return hasTouch && isSmallScreen;
}

/**
 * Hook reativo para saber se a interface está em um celular
 */
export function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileDevice());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
