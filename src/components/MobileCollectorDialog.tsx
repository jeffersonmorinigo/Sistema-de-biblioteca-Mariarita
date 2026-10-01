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
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { showSuccess } from '@/utils/toast';

interface MobileCollectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileCollectorDialog: React.FC<MobileCollectorDialogProps> = ({
  isOpen,
  onClose,
}) => {
  // IP detectado do computador na rede local Wi-Fi
  const [ipAddress, setIpAddress] = useState<string>('10.81.33.68');
  const [port, setPort] = useState<string>('8080');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        setIpAddress(hostname);
      }
      if (window.location.port) {
        setPort(window.location.port);
      }
    }
  }, []);

  // URL para conexão direta ao Coletor nos celulares
  const targetUrl =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? `${window.location.origin}/#/coletor`
      : `https://${ipAddress}:${port}/#/coletor`;

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

            <div className="space-y-2 text-center sm:text-left flex-1">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 gap-1 text-[11px]">
                <Wifi className="w-3 h-3" />
                Rede Wi-Fi Local
              </Badge>

              <h4 className="font-semibold text-sm">
                Aponte a câmera do celular para o QR Code
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Abra a câmera normal do smartphone ou aplicativo leitor de QR Code para abrir o sistema diretamente.
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
                    Os celulares devem estar conectados no mesmo Wi-Fi deste computador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-lg border">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                  2
                </span>
                <div>
                  <span className="font-semibold">Aviso de Certificado (HTTPS Seguro):</span>
                  <p className="text-muted-foreground mt-0.5">
                    Ao abrir o link no celular, se o Chrome/Safari exibir <em>"Sua conexão não é privada"</em>, toque em <strong>"Avançado"</strong> e depois em <strong>"Continuar para {ipAddress} (não seguro)"</strong>. O HTTPS é necessário para o celular liberar o acesso à câmera.
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
                    No celular, toque no botão verde <strong>"Escanear com Câmera"</strong>. Ao bipar o ISBN na contracapa do livro, o sistema busca os dados na internet automaticamente (título, autor, editora) e sincroniza na hora com este computador!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste manual de IP (caso a rede mude) */}
          <details className="text-xs text-muted-foreground pt-1">
            <summary className="cursor-pointer hover:underline font-medium text-slate-600 dark:text-slate-400">
              ⚙️ Opções avançadas de rede (IP do Computador)
            </summary>
            <div className="grid grid-cols-3 gap-2 mt-2 p-3 bg-muted/30 rounded-lg border">
              <div className="col-span-2">
                <Label htmlFor="ipInput" className="text-[11px]">IP do Computador</Label>
                <Input
                  id="ipInput"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="Ex: 10.81.33.68"
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
