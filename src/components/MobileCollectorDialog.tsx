import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Wifi,
  Globe,
  Camera,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';
import { showSuccess } from '@/utils/toast';

interface MobileCollectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkInterface {
  name: string;
  address: string;
}

export const MobileCollectorDialog: React.FC<MobileCollectorDialogProps> = ({
  isOpen,
  onClose,
}) => {
  // Modo de conexão: 'cloud' (Web permanente oficial) ou 'local' (IP direto da rede Wi-Fi)
  const [accessMode, setAccessMode] = useState<'cloud' | 'local'>('cloud');

  // IP detectado do computador na rede local Wi-Fi
  const [ipAddress, setIpAddress] = useState<string>('192.168.1.26');
  const [port, setPort] = useState<string>('8080');
  const [useHttps, setUseHttps] = useState<boolean>(true);
  const [availableIps, setAvailableIps] = useState<NetworkInterface[]>([]);
  const [copied, setCopied] = useState(false);

  const cloudUrl = 'https://sgebiblioteca.web.app/#/coletor';

  useEffect(() => {
    // 1. Tenta obter IP real e portas via Electron IPC (se estiver rodando no app desktop)
    const fetchElectronNetwork = async () => {
      if (typeof window !== 'undefined' && (window as any).electron?.getNetworkInfo) {
        try {
          const info = await (window as any).electron.getNetworkInfo();
          if (info?.primaryIp) {
            setIpAddress(info.primaryIp);
          }
          if (info?.ips && Array.isArray(info.ips)) {
            setAvailableIps(info.ips);
          }
          if (info?.httpsPort) {
            setPort(String(info.httpsPort));
          }
          return;
        } catch (e) {
          console.warn('[MobileCollectorDialog] Falha ao consultar rede pelo Electron:', e);
        }
      }

      // 2. Se rodando no navegador normal (web / vite)
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;

        if (protocol !== 'file:' && hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          setIpAddress(hostname);
          setUseHttps(protocol === 'https:');
          if (window.location.port) {
            setPort(window.location.port);
          }
        }
      }
    };

    if (isOpen) {
      fetchElectronNetwork();
    }
  }, [isOpen]);

  const protocol = useHttps ? 'https' : 'http';
  const localUrl = `${protocol}://${ipAddress}:${port}/#/coletor`;
  const targetUrl = accessMode === 'cloud' ? cloudUrl : localUrl;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    showSuccess('Link copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-lg">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Coleta de Livros por Celular (Multi-Dispositivos)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Vários celulares podem escanear e cadastrar livros simultaneamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Seletor de Modo de Conexão */}
          <div className="flex rounded-lg bg-muted p-1 gap-1 border">
            <button
              type="button"
              onClick={() => setAccessMode('cloud')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                accessMode === 'cloud'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Link Web Oficial (Recomendado)</span>
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] py-0 px-1 ml-0.5">
                Direto
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setAccessMode('local')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                accessMode === 'local'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Rede Wi-Fi Local (Offline)</span>
            </button>
          </div>

          {/* Box de QR Code e Acesso Rápido */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl">
            <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-200 shrink-0">
              <QRCodeSVG
                value={targetUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                {accessMode === 'cloud' ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 gap-1 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    SSL Certificado • Câmera 100% Liberada
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 gap-1 text-[11px]">
                      <Wifi className="w-3 h-3" />
                      Wi-Fi Local
                    </Badge>
                    {useHttps ? (
                      <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border-sky-300 gap-1 text-[11px]">
                        <Lock className="w-3 h-3" />
                        HTTPS (Porta 8080)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 gap-1 text-[11px]">
                        <Unlock className="w-3 h-3" />
                        HTTP (Porta 8081)
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <h4 className="font-semibold text-sm">
                Aponte a câmera do celular para o QR Code
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {accessMode === 'cloud'
                  ? 'Abre diretamente no navegador de qualquer celular com câmera liberada e sem travas de rede ou firewall.'
                  : 'Abre pelo endereço IP local do computador (ambos os aparelhos devem estar no mesmo Wi-Fi).'}
              </p>

              <div className="pt-1 flex items-center gap-1.5 justify-center sm:justify-start">
                <Input
                  value={targetUrl}
                  readOnly
                  className="font-mono text-[11px] h-8 max-w-[210px] bg-white dark:bg-black select-all"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="h-8 px-2.5"
                  title="Copiar link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(targetUrl, '_blank')}
                  className="h-8 px-2"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Passos fáceis para os celulares */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Instruções para Leitura no Celular:
            </h5>

            <div className="grid gap-2 text-xs">
              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  1
                </span>
                <div>
                  <span className="font-semibold">Abra no Celular:</span>
                  <p className="text-muted-foreground mt-0.5">
                    Aponte a câmera normal do celular para o QR Code acima ou digite o link no Chrome ou Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  2
                </span>
                <div>
                  <span className="font-semibold">Permitir Câmera:</span>
                  <p className="text-muted-foreground mt-0.5">
                    Toque em <strong>"Escanear com Câmera"</strong> e confirme em <strong>"Permitir"</strong> quando o navegador solicitar acesso à câmera do smartphone.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  3
                </span>
                <div>
                  <span className="font-semibold">Bipar Código de Barras (ISBN):</span>
                  <p className="text-muted-foreground mt-0.5">
                    Aponte para o código de barras na contracapa do livro. O sistema toca um aviso sonoro (bip), busca na BrasilAPI e salva automaticamente no banco da biblioteca!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste de IP e Interfaces de Rede (para modo Local) */}
          {accessMode === 'local' && (
            <details className="text-xs text-muted-foreground pt-1">
              <summary className="cursor-pointer hover:underline font-medium text-slate-600 dark:text-slate-400">
                ⚙️ Configurações avançadas de IP local ({ipAddress})
              </summary>
              <div className="space-y-2 mt-2 p-2.5 bg-muted/30 rounded-lg border">
                {availableIps.length > 0 && (
                  <div>
                    <Label className="text-[11px] mb-1 block">Adaptadores detectados:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableIps.map((net) => (
                        <Button
                          key={net.address}
                          type="button"
                          size="sm"
                          variant={ipAddress === net.address ? 'default' : 'outline'}
                          onClick={() => setIpAddress(net.address)}
                          className="h-7 text-xs px-2"
                        >
                          {net.name}: {net.address}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="ipInput" className="text-[11px]">IP do Computador</Label>
                    <Input
                      id="ipInput"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="192.168.1.26"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portInput" className="text-[11px]">Porta</Label>
                    <Input
                      id="portInput"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="8080"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Protocolo</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = !useHttps;
                        setUseHttps(next);
                        setPort(next ? '8080' : '8081');
                      }}
                      className="h-8 w-full text-xs"
                    >
                      {useHttps ? 'HTTPS (8080)' : 'HTTP (8081)'}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
