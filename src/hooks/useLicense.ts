import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentLicenseStatus,
  activateNewLicense,
  removeLicenseKey,
  generateLicenseKey,
  type LicenseStatusInfo,
} from '@/utils/licenseService';

export function useLicense() {
  const [licenseInfo, setLicenseInfo] = useState<LicenseStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const info = await getCurrentLicenseStatus();
      setLicenseInfo(info);
    } catch (e) {
      console.error('[useLicense] Erro ao carregar status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleUpdate = () => {
      refresh();
    };

    window.addEventListener('system-license-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    // Checagem periódica a cada 5 minutos para monitorar expiração em tempo real
    const interval = setInterval(refresh, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('system-license-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [refresh]);

  const activate = useCallback(async (key: string) => {
    const res = await activateNewLicense(key);
    if (res.success && res.info) {
      setLicenseInfo(res.info);
    }
    return res;
  }, []);

  const remove = useCallback(async () => {
    await removeLicenseKey();
    await refresh();
  }, [refresh]);

  return {
    licenseInfo,
    loading,
    refresh,
    activate,
    remove,
    generateKey: generateLicenseKey,
  };
}
