import React, { useState, useEffect } from 'react';
import { subscribeToSyncStatus, syncNow, SyncState } from '@/lib/syncService';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const SyncStatusBadge: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>({
    status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncStatus((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  const handleSyncClick = async () => {
    setIsManualSyncing(true);
    try {
      await syncNow();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  const isSyncing = syncState.status === 'syncing' || isManualSyncing;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card/60 text-xs shadow-sm select-none">
            {/* Ícone de status */}
            {isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            ) : syncState.status === 'online' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <CloudOff className="h-3.5 w-3.5 text-amber-500" />
            )}

            {/* Texto explicativo */}
            <div className="flex flex-col text-left">
              <span className="font-medium leading-none">
                {isSyncing
                  ? 'Sincronizando...'
                  : syncState.status === 'online'
                  ? 'Banco Vinculado (Nuvem)'
                  : 'Modo Offline (Local)'}
              </span>
              {syncState.pendingCount > 0 && (
                <span className="text-[10px] text-amber-600 font-semibold mt-0.5">
                  {syncState.pendingCount} alteraç{syncState.pendingCount === 1 ? 'ão' : 'ões'} salva(s) localmente
                </span>
              )}
            </div>

            {/* Botão de sincronização manual */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              onClick={handleSyncClick}
              disabled={isSyncing}
              title="Sincronizar com a nuvem agora"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          <p className="font-semibold mb-1">Banco de Dados Local Híbrido</p>
          <p className="text-muted-foreground">
            Todas as alterações são salvas instantaneamente no computador da escola e enviadas automaticamente para o Firebase quando houver internet.
          </p>
          {syncState.lastSyncTime && (
            <p className="mt-1 text-[11px] text-emerald-600">
              Última sincronização: {syncState.lastSyncTime.toLocaleTimeString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
