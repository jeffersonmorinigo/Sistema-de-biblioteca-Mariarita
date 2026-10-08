import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Flashlight,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  SwitchCamera,
  ExternalLink,
  ZoomIn,
} from 'lucide-react';
import { isLikelyIsbn } from '@/lib/isbnService';

// Declaração da API nativa BarcodeDetector (Chrome Android 83+)
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

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
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInsecureHttp, setIsInsecureHttp] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [scannerMode, setScannerMode] = useState<'native' | 'fallback' | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeScanLoopRef = useRef<number | null>(null);
  const containerId = 'interactive-camera-barcode-reader';
  const lastScannedCode = useRef<string>('');
  const lastScanTimestamp = useRef<number>(0);
  const isClosingRef = useRef<boolean>(false);

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
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {}
  };

  // Vibração tátil em smartphones
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(120);
      }
    } catch (e) {}
  };

  // Processa o código lido com debounce
  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (isClosingRef.current) return;

      const now = Date.now();
      const cleanText = decodedText.trim();

      if (cleanText === lastScannedCode.current && now - lastScanTimestamp.current < 2500) {
        return;
      }

      isClosingRef.current = true;
      lastScannedCode.current = cleanText;
      lastScanTimestamp.current = now;

      playBeep();
      triggerHaptic();
      setScanStatus(`✅ Código captado: ${cleanText}`);

      onScanSuccess(cleanText);
      stopScanner();
      onClose();
    },
    [onScanSuccess, onClose]
  );

  // === NATIVE BarcodeDetector SCANNER (Chrome Android 83+) ===
  const startNativeScanner = async () => {
    setErrorMessage(null);
    setScanStatus('Iniciando câmera de alta definição...');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: selectedCameraId ? undefined : { ideal: 'environment' },
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      videoRef.current = video;

      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }

      await video.play();

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const caps = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (caps?.torch) {
          setHasTorch(true);
        }

        const advancedList: any[] = [];
        if (caps?.focusMode?.includes('continuous')) {
          advancedList.push({ focusMode: 'continuous' });
        }

        if (caps?.zoom) {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 5;
          const step = caps.zoom.step || 0.1;
          setZoomCapabilities({ min, max, step });

          // Zoom macro confortável (1.3x) para afastar o celular
          const initialZoom = Math.min(Math.max(1.3, min), Math.min(2.0, max));
          advancedList.push({ zoom: initialZoom });
          setZoomLevel(initialZoom);
        }

        if (advancedList.length > 0) {
          try {
            await videoTrack.applyConstraints({ advanced: advancedList });
          } catch (e) {}
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
          if (videoDevices.length > 0) {
            setAvailableCameras(videoDevices);
          }
        } catch (e) {}
      }

      const detector = new window.BarcodeDetector!({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });

      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      setScannerMode('native');
      setIsScanning(true);
      setScanStatus('📷 Foco nítido ativo — aponte para o código de barras');

      const scanLoop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || isClosingRef.current) {
          if (!isClosingRef.current) {
            nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
          }
          return;
        }

        try {
          let barcodes: Array<{ rawValue: string; format: string }> = [];

          // Detecção direta no elemento de vídeo (zero-copy GPU)
          try {
            barcodes = await detector.detect(videoRef.current);
          } catch (detectErr) {
            // Fallback via canvas
            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;
            if (vw > 0 && vh > 0) {
              canvas.width = vw;
              canvas.height = vh;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, vw, vh);
                barcodes = await detector.detect(canvas);
              }
            }
          }

          if (barcodes && barcodes.length > 0 && !isClosingRef.current) {
            // Prioriza EAN-13 ou códigos com formato plausível de ISBN
            const sorted = [...barcodes].sort((a, b) => {
              const aIsbn = isLikelyIsbn(a.rawValue) || a.format === 'ean_13';
              const bIsbn = isLikelyIsbn(b.rawValue) || b.format === 'ean_13';
              if (aIsbn && !bIsbn) return -1;
              if (!aIsbn && bIsbn) return 1;
              return 0;
            });

            const code = sorted[0]?.rawValue?.trim();
            if (code) {
              handleScanSuccess(code);
              return;
            }
          }
        } catch (e) {}

        // Throttle suave de ~35ms (~28 FPS)
        await new Promise((r) => setTimeout(r, 35));
        if (!isClosingRef.current) {
          nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
        }
      };

      nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn('[CameraBarcodeScanner] Falha no scanner nativo, tentando fallback:', err);
      await startFallbackScanner();
    }
  };

  // === FALLBACK: html5-qrcode ===
  const startFallbackScanner = async () => {
    setErrorMessage(null);
    setScanStatus('Iniciando modo compatibilidade...');

    try {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
        }
      } catch (e) {}

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 25,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Formato retangular otimizado para o código de barras ISBN do livro (~2.4 : 1)
          const w = Math.floor(Math.min(viewfinderWidth * 0.90, 420));
          const h = Math.floor(w * 0.42);
          return { width: w, height: h };
        },
        aspectRatio: 1.777,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      let started = false;
      const candidates: any[] = [];
      if (selectedCameraId) {
        candidates.push({ deviceId: { exact: selectedCameraId } });
      }
      candidates.push({
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      });
      candidates.push({ facingMode: 'environment' });
      candidates.push({ facingMode: { ideal: 'environment' } });
      candidates.push(true);

      let lastErr: any = null;
      for (const camSource of candidates) {
        try {
          await html5QrCode.start(
            camSource as any,
            config as any,
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => {}
          );
          started = true;
          break;
        } catch (attemptErr) {
          lastErr = attemptErr;
          console.warn('[CameraBarcodeScanner] Tentativa de câmera falhou:', camSource, attemptErr);
        }
      }

      if (!started) {
        throw lastErr || new Error('Não foi possível iniciar o vídeo da câmera.');
      }

      setScannerMode('fallback');
      setIsScanning(true);
      setScanStatus('📷 Scanner ativo — aponte para o código de barras');

      try {
        const runningTrack = (html5QrCode as any).getRunningTrackCapabilities?.();
        if (runningTrack) {
          if (runningTrack.torch) {
            setHasTorch(true);
          }
          if (runningTrack.zoom) {
            const min = runningTrack.zoom.min || 1;
            const max = runningTrack.zoom.max || 5;
            const step = runningTrack.zoom.step || 0.1;
            setZoomCapabilities({ min, max, step });
            const initialZoom = Math.min(Math.max(1.3, min), Math.min(2.0, max));
            try {
              await (html5QrCode as any).applyVideoConstraints({
                advanced: [{ zoom: initialZoom }],
              });
              setZoomLevel(initialZoom);
            } catch (e) {}
          }
        }
      } catch (e) {}
    } catch (err: any) {
      console.error('[CameraBarcodeScanner] Erro ao iniciar câmera:', err);
      setIsScanning(false);
      setErrorMessage(
        err?.message ||
          'Não foi possível acessar a câmera. Verifique permissões do navegador e se está em conexão HTTPS.'
      );
    }
  };

  // === UNIFIED START ===
  const startScanner = async () => {
    setErrorMessage(null);
    isClosingRef.current = false;

    // 1. Tenta API BarcodeDetector nativa do Android (Chrome 83+)
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        const supported = await (window.BarcodeDetector as any).getSupportedFormats?.();
        if (supported && supported.includes('ean_13')) {
          await startNativeScanner();
          return;
        }
      } catch (e) {}

      try {
        await startNativeScanner();
        return;
      } catch (e) {}
    }

    // 2. Fallback
    await startFallbackScanner();
  };

  const stopScanner = async () => {
    if (nativeScanLoopRef.current) {
      cancelAnimationFrame(nativeScanLoopRef.current);
      nativeScanLoopRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }

    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    setIsScanning(false);
    setTorchEnabled(false);
    setHasTorch(false);
    setZoomCapabilities(null);
    setZoomLevel(1);
    setScannerMode(null);
    setScanStatus('');
  };

  const toggleTorch = async () => {
    try {
      const nextState = !torchEnabled;
      if (scannerMode === 'native' && streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setTorchEnabled(nextState);
      } else if (scannerRef.current) {
        await (scannerRef.current as any).applyVideoConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      }
    } catch (e) {
      console.warn('Falha ao alternar lanterna:', e);
    }
  };

  // Alterna zoom (1x -> 2x -> 3x -> 1x)
  const toggleZoom = async () => {
    const track =
      streamRef.current?.getVideoTracks()[0] ||
      (scannerRef.current as any)?.getRunningTrack?.() ||
      (scannerRef.current as any)?._localMediaStream?.getVideoTracks?.()[0];

    const min = zoomCapabilities?.min || 1;
    const max = zoomCapabilities?.max || 4;

    let nextZoom = 1;
    if (zoomLevel < 1.7) {
      nextZoom = Math.min(2.0, max);
    } else if (zoomLevel < 2.7 && max >= 2.5) {
      nextZoom = Math.min(3.0, max);
    } else {
      nextZoom = min;
    }

    try {
      if (track) {
        await track.applyConstraints({ advanced: [{ zoom: nextZoom } as any] });
      } else if (scannerRef.current) {
        await (scannerRef.current as any).applyVideoConstraints({
          advanced: [{ zoom: nextZoom }],
        });
      }
      setZoomLevel(nextZoom);
      setScanStatus(`🔍 Zoom ${nextZoom.toFixed(1)}x ativado`);
      triggerHaptic();
    } catch (e) {
      console.warn('Erro ao alternar zoom:', e);
    }
  };

  // Tap to focus
  const handleTapToFocus = async () => {
    triggerHaptic();
    setScanStatus('🎯 Ajustando foco automático...');
    try {
      const track =
        streamRef.current?.getVideoTracks()[0] ||
        (scannerRef.current as any)?.getRunningTrack?.() ||
        (scannerRef.current as any)?._localMediaStream?.getVideoTracks?.()[0];

      if (track) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        });
      }
    } catch (e) {}
    setTimeout(() => {
      setScanStatus('📷 Foco nítido ativo — mantenha o livro a ~20cm');
    }, 1200);
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    await stopScanner();
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setIsInsecureHttp(true);
      return;
    } else {
      setIsInsecureHttp(false);
    }

    let isMounted = true;
    const initTimer = setTimeout(() => {
      if (isMounted) {
        startScanner();
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      stopScanner();
    };
  }, [isOpen, selectedCameraId]);

  const httpsUrl = typeof window !== 'undefined' ? window.location.href.replace('http://', 'https://') : '';

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
            Aponte a câmera para o código de barras (ISBN) na contracapa do livro. Mantenha a ~20cm de distância.
          </p>
        </DialogHeader>

        {isInsecureHttp ? (
          <div className="bg-amber-950/80 border border-amber-700/70 rounded-xl p-5 text-center my-3 space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="font-semibold text-amber-100 text-base">Acesso HTTPS Necessário no Celular</h4>
            <p className="text-xs text-amber-200/90 leading-relaxed text-left">
              Os navegadores de celular bloqueiam a câmera em conexões HTTP. Acesse através do endereço HTTPS seguro.
            </p>
            <div className="bg-black/50 p-3 rounded-lg border border-amber-800/40 text-left space-y-1">
              <span className="text-[11px] text-amber-400 font-semibold block">Acesse pelo endereço HTTPS:</span>
              <a
                href={httpsUrl}
                className="text-xs font-mono text-emerald-400 underline break-all flex items-center gap-1 hover:text-emerald-300"
              >
                {httpsUrl}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = httpsUrl;
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none mt-2"
            >
              Ir para versão HTTPS
            </Button>
          </div>
        ) : errorMessage ? (
          <div className="bg-red-950/60 border border-red-800 rounded-lg p-4 text-center my-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-200">{errorMessage}</p>
            <p className="text-xs text-slate-400 mt-2">
              Certifique-se de conceder permissão de câmera ao navegador do celular.
            </p>
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
          <div
            onClick={isScanning ? handleTapToFocus : undefined}
            title={isScanning ? 'Toque para focar a lente' : undefined}
            className={`relative w-full overflow-hidden rounded-xl bg-black border border-slate-800 min-h-[300px] flex items-center justify-center transition-all ${
              isScanning ? 'cursor-pointer select-none active:brightness-110' : ''
            }`}
          >
            {/* Elemento de renderização da câmera (nativo ou Html5Qrcode) */}
            <div id={containerId} className="w-full h-full flex items-center justify-center" />

            {/* Linha guia visual animada de escaneamento em formato retangular ISBN (~2.4:1) */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-[88%] h-[40%] border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                  {/* Cantos destacados */}
                  <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                  <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                  {/* Linha vermelha central de varredura */}
                  <div className="absolute top-1/2 left-[4%] right-[4%] h-[2.5px] bg-red-500 shadow-[0_0_10px_#ef4444] rounded-full animate-pulse" />
                </div>

                <div className="flex flex-col items-center mt-3 space-y-1">
                  <span className="text-[11px] text-emerald-300 font-semibold bg-black/75 px-3 py-1 rounded-full backdrop-blur-md border border-emerald-500/30">
                    Posicione o código de barras no retângulo
                  </span>
                  <span className="text-[9.5px] text-slate-300 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                    Distância ideal: ~20cm • Toque para focar
                  </span>
                  {scanStatus && (
                    <span className="text-[9px] text-emerald-400/90 bg-black/50 px-2 py-0.5 rounded-full font-mono">
                      {scanStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!isScanning && !errorMessage && !isInsecureHttp && (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="text-xs">Iniciando câmera de alta definição...</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {hasTorch && isScanning && (
              <Button
                type="button"
                variant={torchEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleTorch}
                className={`gap-1.5 text-xs ${torchEnabled ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'border-slate-700 text-slate-300'}`}
              >
                <Flashlight className="w-4 h-4 text-amber-300" />
                {torchEnabled ? 'Lanterna On' : 'Lanterna'}
              </Button>
            )}

            {zoomCapabilities && isScanning && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleZoom}
                className="gap-1.5 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
              >
                <ZoomIn className="w-4 h-4 text-emerald-400" />
                Zoom {zoomLevel.toFixed(1)}x
              </Button>
            )}

            {availableCameras.length > 1 && isScanning && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={switchCamera}
                title="Trocar câmera"
                className="gap-1.5 text-xs border-slate-700 text-slate-300"
              >
                <SwitchCamera className="w-4 h-4 text-emerald-400" />
                Câmera
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
