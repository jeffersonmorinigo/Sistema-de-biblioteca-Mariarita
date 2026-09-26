import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Flashlight, RefreshCw, X, AlertCircle } from 'lucide-react';
import { showError } from '@/utils/toast';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  title?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Escanear Código de Barras / ISBN',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'interactive-camera-barcode-reader';
  const lastScannedCode = useRef<string>('');
  const lastScanTimestamp = useRef<number>(0);

  // Reproduz bip sonoro agradável usando Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Tom A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Ignora erro de áudio se navegador bloquear
    }
  };

  // Vibração tátil em smartphones
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setErrorMessage(null);

    const startScanner = async () => {
      try {
        // Aguarda a renderização do DOM do dialog
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!isMounted) return;

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.85),
              height: Math.floor(minEdge * 0.45), // Formato retangular ideal para códigos de barras de livros
            };
          },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const now = Date.now();
            const cleanText = decodedText.trim();

            // Debounce: ignora mesmo código lido em menos de 2 segundos
            if (cleanText === lastScannedCode.current && now - lastScanTimestamp.current < 2000) {
              return;
            }

            lastScannedCode.current = cleanText;
            lastScanTimestamp.current = now;

            playBeep();
            triggerHaptic();
            onScanSuccess(cleanText);
            stopScanner();
            onClose();
          },
          () => {
            // Ignora frames sem código detectado
          }
        );

        if (isMounted) {
          setIsScanning(true);
          // Verifica se há suporte para lanterna (Torch)
          try {
            const runningTrack = (html5QrCode as any).getRunningTrackCapabilities?.();
            if (runningTrack && runningTrack.torch) {
              setHasTorch(true);
            }
          } catch (e) {}
        }
      } catch (err: any) {
        console.error('[CameraBarcodeScanner] Erro ao iniciar câmera:', err);
        if (isMounted) {
          setIsScanning(false);
          const msg =
            err?.message ||
            'Não foi possível acessar a câmera. Verifique se deu permissão no navegador ou se está em conexão segura HTTPS.';
          setErrorMessage(msg);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('[CameraBarcodeScanner] Erro ao parar scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextState = !torchEnabled;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch (e) {
      console.warn('Falha ao alternar lanterna:', e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-4 sm:p-6 bg-slate-900 text-white border-slate-800">
        <DialogHeader className="mb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg text-white font-semibold">
              <Camera className="w-5 h-5 text-emerald-400" />
              {title}
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-400">
            Aponte a câmera traseira do celular para o código de barras (ISBN) na contracapa do livro.
          </p>
        </DialogHeader>

        {errorMessage ? (
          <div className="bg-red-950/60 border border-red-800 rounded-lg p-4 text-center my-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-200">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                stopScanner();
                onClose();
              }}
              className="mt-4 border-slate-700 text-slate-200"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-xl bg-black border border-slate-800 min-h-[300px] flex items-center justify-center">
            {/* Elemento de renderização da câmera Html5Qrcode */}
            <div id={containerId} className="w-full h-full" />

            {/* Linha guia visual animada de escaneamento */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-[85%] h-[45%] border-2 border-emerald-400/80 rounded-lg relative shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse">
                  <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444]" />
                </div>
                <span className="text-[11px] text-emerald-300 font-medium mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                  Posicione o código de barras no retângulo
                </span>
              </div>
            )}

            {!isScanning && !errorMessage && (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="text-xs">Iniciando câmera...</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-800">
          {hasTorch && isScanning ? (
            <Button
              type="button"
              variant={torchEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={toggleTorch}
              className="gap-2 text-xs"
            >
              <Flashlight className="w-4 h-4" />
              {torchEnabled ? 'Desligar Lanterna' : 'Ligar Lanterna'}
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
