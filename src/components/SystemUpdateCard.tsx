import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Lock,
  ArrowUpCircle,
  FileText,
} from 'lucide-react';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { checkSystemUpdates, publishNewVersion, type UpdateInfo } from '@/utils/updateService';

export const SystemUpdateCard: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Estados da Área do Desenvolvedor (Publicar Atualizações)
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [newVersionInput, setNewVersionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [downloadUrlInput, setDownloadUrlInput] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Carrega a versão instalada inicialmente
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.electron && typeof window.electron.onDownloadProgress === 'function') {
      unlisten = window.electron.onDownloadProgress((percent) => {
        setDownloadProgress(percent);
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const res = await checkSystemUpdates();
      setUpdateInfo(res);
      setLastChecked(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

      if (res.updateAvailable) {
        showInfo(`Nova versão encontrada: v${res.latestVersion}!`);
      } else {
        showSuccess('Seu sistema já está na versão mais recente!');
      }
    } catch (e: any) {
      showError('Erro ao verificar atualizações: ' + (e?.message || 'Tente novamente'));
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo?.downloadUrl) {
      showError('Nenhuma URL de download disponível para esta versão.');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    // Se estiver no Electron, usa o updater nativo
    if (typeof window !== 'undefined' && window.electron && typeof window.electron.downloadAndInstallUpdate === 'function') {
      try {
        const res = await window.electron.downloadAndInstallUpdate(updateInfo.downloadUrl);
        if (res.openedInBrowser) {
          showInfo('O download foi aberto no navegador para instalação.');
          setDownloading(false);
        } else if (res.executingInstaller) {
          showSuccess('Download concluído! O sistema está sendo reiniciado para aplicar a atualização...');
        }
      } catch (err: any) {
        showError('Erro ao atualizar: ' + (err?.message || 'Tente abrir pelo link'));
        setDownloading(false);
      }
    } else {
      // Se for Web, abre a URL de download
      window.open(updateInfo.downloadUrl, '_blank');
      setDownloading(false);
    }
  };

  const handleUnlockDev = (e: React.FormEvent) => {
    e.preventDefault();
    if (devPassword.trim() === 'AdminDev@2026') {
      setDevUnlocked(true);
      setDevPassword('');
      showSuccess('Painel de publicação de atualizações liberado!');
    } else {
      showError('Senha mestre incorreta.');
    }
  };

  const handlePublish = async () => {
    if (!newVersionInput.trim()) {
      showError('Informe o número da versão (ex: 1.0.1).');
      return;
    }
    if (!notesInput.trim()) {
      showError('Informe as notas da versão (o que foi resolvido).');
      return;
    }

    setPublishing(true);
    try {
      await publishNewVersion({
        version: newVersionInput.trim(),
        notes: notesInput.trim(),
        downloadUrl: downloadUrlInput.trim(),
      });
      showSuccess(`Versão v${newVersionInput.trim()} publicada com sucesso!`);
      setDevDialogOpen(false);
      setNewVersionInput('');
      setNotesInput('');
      setDownloadUrlInput('');
      // Re-executa verificação imediatamente
      handleCheckUpdates();
    } catch (e: any) {
      showError('Erro ao publicar versão: ' + e?.message);
    } finally {
      setPublishing(false);
    }
  };

  const currentVersion = updateInfo?.currentVersion || '1.0.0';
  const hasUpdate = updateInfo?.updateAvailable ?? false;

  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="h-6 w-6 text-primary shrink-0" />
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Atualização do Sistema
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Verifique e instale novas versões e correções do software.
                </CardDescription>
              </div>
            </div>
            {hasUpdate && (
              <Badge className="bg-primary text-primary-foreground animate-pulse text-xs">
                Nova Versão
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Box de Informações de Versão */}
          <div className="rounded-xl border bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-3 shadow-inner">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Versão Atual Instalada:</span>
              <span className="font-mono font-semibold text-foreground bg-background px-2.5 py-0.5 rounded border text-xs">
                v{currentVersion}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Status do Sistema:</span>
              {hasUpdate ? (
                <span className="font-semibold text-primary flex items-center gap-1.5 text-xs">
                  <ArrowUpCircle className="h-4 w-4" />
                  Atualização v{updateInfo?.latestVersion} Disponível!
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  Sistema Atualizado
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Última Verificação:</span>
              <span className="text-xs text-muted-foreground font-medium">
                {lastChecked ? `Hoje às ${lastChecked}` : 'Não verificado nesta sessão'}
              </span>
            </div>

            {/* Seção quando há atualização disponível */}
            {hasUpdate && updateInfo && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-300">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Novidades da Versão {updateInfo.latestVersion}:
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                    {updateInfo.releaseNotes}
                  </p>
                </div>

                {downloading ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Baixando atualização...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <Progress value={downloadProgress} className="h-2" />
                    <p className="text-[11px] text-muted-foreground text-center">
                      O sistema será reiniciado automaticamente ao concluir.
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 shadow-sm"
                    onClick={handleDownloadAndInstall}
                  >
                    <DownloadCloud className="h-4 w-4 mr-2" />
                    Baixar e Atualizar Agora
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Botão de Verificação Principal */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled={checking || downloading}
              className="w-full h-10 font-medium flex items-center justify-center gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
              onClick={handleCheckUpdates}
            >
              <RefreshCw className={`h-4 w-4 text-slate-700 dark:text-slate-300 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Verificando Servidor...' : 'Verificar Atualizações Agora'}
            </Button>

            {/* Link para o desenvolvedor gerenciar/publicar novas versões */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setDevDialogOpen(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <Lock className="h-3 w-3" />
                Publicar Nova Versão (Desenvolvedor)
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Publicação de Versão pelo Desenvolvedor */}
      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Publicar Atualização do Sistema
            </DialogTitle>
            <DialogDescription className="text-xs">
              Disponibilize correções e novas versões para todos os computadores que utilizam o sistema.
            </DialogDescription>
          </DialogHeader>

          {!devUnlocked ? (
            <form onSubmit={handleUnlockDev} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="dev-update-pass" className="text-xs font-medium">
                  Senha Mestre de Desenvolvedor
                </Label>
                <Input
                  id="dev-update-pass"
                  type="password"
                  placeholder="Digite a senha mestre de desenvolvedor"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full text-xs">
                  Desbloquear Painel de Publicação
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3.5 py-1">
              <div className="space-y-1">
                <Label className="text-xs">Número da Nova Versão</Label>
                <Input
                  placeholder="Ex: 1.0.1 ou 1.1.0"
                  value={newVersionInput}
                  onChange={(e) => setNewVersionInput(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notas da Versão (O que foi resolvido / Novidades)</Label>
                <Textarea
                  placeholder="Ex: - Correção no cadastro de livros&#10;- Aumento de velocidade&#10;- Novo relatório disponível"
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Link do Instalador (.exe) ou Página de Download</Label>
                <Input
                  placeholder="Ex: https://github.com/.../releases/download/...exe"
                  value={downloadUrlInput}
                  onChange={(e) => setDownloadUrlInput(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Opcional: Se deixar em branco, direciona para as releases do GitHub.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDevDialogOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="text-xs bg-primary"
                >
                  {publishing ? 'Publicando...' : 'Publicar Atualização'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
