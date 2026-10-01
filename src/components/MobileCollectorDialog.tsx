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
  ShieldCheck,
  Camera,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Lock,
  Unlock,
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
  // IP detectado do computador na rede local Wi-Fi
  const [ipAddress, setIpAddress] = useState<string>('192.168.100.2');
  const [port, setPort] = useState<string>('8080');
  const [useHttps, setUseHttps] = useState<boolean>(true);
  const [availableIps, setAvailableIps] = useState<NetworkInterface[]>([]);
  const [copied, setCopied] = useState(false);

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

        // Se estiver no protocolo file:, nunca usar file://!
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

  // Monta a URL para os celulares (nunca usa file:///)
  const protocol = useHttps ? 'https' : 'http';
  const targetUrl = `${protocol}://${ipAddress}:${port}/#/coletor`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    showSuccess('Link copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
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

        <div className="space-y-4 py-2">
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
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 gap-1 text-[11px]">
                  <Wifi className="w-3 h-3" />
                  Rede Wi-Fi Local
                </Badge>
                {useHttps ? (
                  <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border-sky-300 gap-1 text-[11px]">
                    <Lock className="w-3 h-3" />
                    HTTPS (Câmera Ativa)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 gap-1 text-[11px]">
                    <Unlock className="w-3 h-3" />
                    HTTP
                  </Badge>
                )}
              </div>

              <h4 className="font-semibold text-sm">
                Aponte a câmera do celular para o QR Code
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Abra a câmera do smartphone ou app de QR Code para abrir o leitor de livros.
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
          <div className="space-y-2.5">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Instruções para os Coletadores:
            </h5>

            <div className="grid gap-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  1
                </span>
                <div>
                  <span className="font-semibold">Mesma rede Wi-Fi:</span>
                  <p className="text-muted-foreground mt-0.5">
                    O celular e o computador da biblioteca devem estar conectados na mesma rede Wi-Fi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  2
                </span>
                <div>
                  <span className="font-semibold">Aviso no Celular (Certificado HTTPS Seguro):</span>
                  <p className="text-muted-foreground mt-0.5">
                    Ao abrir a página no celular pela 1ª vez, se exibir <em>"Sua conexão não é privada"</em>, toque em <strong>"Avançado"</strong> e depois em <strong>"Continuar para {ipAddress} (não seguro)"</strong>. O HTTPS é obrigatório pelo Chrome/Safari para liberar a câmera do celular.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  3
                </span>
                <div>
                  <span className="font-semibold">Escanear e Cadastrar:</span>
                  <p className="text-muted-foreground mt-0.5">
                    No celular, toque no botão verde <strong>"Escanear com Câmera"</strong>. Ao bipar o código de barras/ISBN na contracapa, o sistema busca os dados online e salva diretamente no sistema!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste de IP e Interfaces de Rede */}
          <details className="text-xs text-muted-foreground pt-1">
            <summary className="cursor-pointer hover:underline font-medium text-slate-600 dark:text-slate-400">
              ⚙️ Opções avançadas de rede (IP do Computador)
            </summary>
            <div className="space-y-3 mt-2 p-3 bg-muted/30 rounded-lg border">
              {availableIps.length > 0 && (
                <div>
                  <Label className="text-[11px] mb-1 block">Interfaces de Rede Detectadas:</Label>
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
                    placeholder="Ex: 192.168.100.2"
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
        </div>

        <div className="flex justify-end pt-3 border-t">
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
