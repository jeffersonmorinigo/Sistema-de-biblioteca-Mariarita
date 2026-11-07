import React, { useState, useEffect } from 'react';
import {
  subscribeToRemoteUpdates,
  applyOtaUpdateService,
  restartAppService,
  UpdateInfo,
} from '@/utils/updateService';
import { Button } from '@/components/ui/button';
import { Rocket, RefreshCw, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export const GlobalUpdateNotifier: React.FC = () => {
  const [readyVersion, setReadyVersion] = useState<string | null>(null);
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Ouvinte para eventos disparados pelo processo principal do Electron
    let unlistenReady: (() => void) | undefined;
    let unlistenDownloading: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;

    if (typeof window !== 'undefined' && window.electron) {
      if (typeof window.electron.onOtaUpdateReady === 'function') {
        unlistenReady = window.electron.onOtaUpdateReady((data) => {
          setDownloadingVersion(null);
          setReadyVersion(data.version);
          setDismissed(false);
          toast.success(`Nova versão v${data.version} instalada automaticamente!`, {
            description: 'Clique em reiniciar para aplicar as novidades sem reinstalar.',
            duration: 10000,
          });
        });
      }

      if (typeof window.electron.onOtaUpdateDownloading === 'function') {
        unlistenDownloading = window.electron.onOtaUpdateDownloading((data) => {
          setDownloadingVersion(data.version);
        });
      }

      if (typeof window.electron.onDownloadProgress === 'function') {
        unlistenProgress = window.electron.onDownloadProgress((percent) => {
          setDownloadProgress(percent);
        });
      }
    }

    // 2. Ouvinte em tempo real via Firestore (atualiza instantaneamente todos os PCs conectados)
    const unsubscribeFirestore = subscribeToRemoteUpdates(async (info: UpdateInfo) => {
      if (readyVersion === info.latestVersion) return;

      if (info.distUrl && typeof window !== 'undefined' && window.electron) {
        try {
          setDownloadingVersion(info.latestVersion);
          await applyOtaUpdateService(info.distUrl, info.latestVersion);
          setDownloadingVersion(null);
          setReadyVersion(info.latestVersion);
          setDismissed(false);
        } catch (err: any) {
          console.warn('[GlobalUpdateNotifier] Erro no auto-update OTA via Firestore:', err);
          setDownloadingVersion(null);
        }
      }
    });

    return () => {
      if (unlistenReady) unlistenReady();
      if (unlistenDownloading) unlistenDownloading();
      if (unlistenProgress) unlistenProgress();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [readyVersion]);

  const handleRestart = async () => {
    try {
      await restartAppService();
    } catch {
      window.location.reload();
    }
  };

  if (dismissed) return null;

  // Banner quando o download está ocorrendo em segundo plano
  if (downloadingVersion && !readyVersion) {
    return (
      <div className="bg-blue-600 text-white text-xs sm:text-sm px-4 py-2 flex items-center justify-between shadow-md animate-in fade-in sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>
            Baixando atualização <strong>v{downloadingVersion}</strong> em segundo plano para este computador...
            {downloadProgress > 0 && ` (${downloadProgress}%)`}
          </span>
        </div>
        <span className="text-blue-100 text-xs hidden sm:inline">Não requer reinstalação</span>
      </div>
    );
  }

  // Banner quando a nova versão já está descompactada e pronta para uso
  if (readyVersion) {
    return (
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-xs sm:text-sm px-4 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50 border-b border-emerald-400/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1 bg-white/20 rounded-md">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-semibold">Atualização v{readyVersion} pronta!</span>
            <span className="ml-1 text-emerald-100 hidden sm:inline">
              O sistema foi atualizado automaticamente sem necessidade de reinstalar o executável.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRestart}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-7 px-3 shadow"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
            Reiniciar Sistema Agora
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            title="Fechar (será aplicado na próxima reinicialização)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default GlobalUpdateNotifier;
