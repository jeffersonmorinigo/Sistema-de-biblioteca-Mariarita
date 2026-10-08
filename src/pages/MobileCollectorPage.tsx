import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useFirestore } from '@/hooks/useFirestore';
import { useSettings } from '@/hooks/useSettings';
import { Book } from '@/lib/types';
import { fetchBookDetailsByIsbn, isLikelyIsbn, cleanIsbn, matchSystemCategory, matchSystemBookType } from '@/lib/isbnService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Camera,
  Flashlight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  SwitchCamera,
  Plus,
  Keyboard,
  Search,
  Loader2,
  Edit3,
  ZoomIn,
  Image as ImageIcon,
  HelpCircle,
  Info,
} from 'lucide-react';
import { showSuccess, showError, showInfo } from '@/utils/toast';

// Tipo para a API nativa BarcodeDetector (Chrome Android 83+)
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

export const MobileCollectorPage: React.FC = () => {
  const { data: books, add: addBook } = useFirestore<Book>('books');
  const { settings } = useSettings();

  const categories = settings.book_categories || ['LITERATURA', 'DIDÁTICO', 'INFANTIL', 'GERAL'];
  const shelves = settings.book_shelves || ['P1', 'P2', 'P3', 'A1', 'A2', 'B1'];
  const bookTypes = settings.book_types || ['LIVRO', 'REVISTA', 'GIBI'];

  // Configurações do Coletor
  const [selectedShelf, setSelectedShelf] = useState<string>(shelves[0] || 'P1');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'LITERATURA');
  const [selectedType, setSelectedType] = useState<string>(bookTypes[0] || 'LIVRO');
  const [autoSave, setAutoSave] = useState<boolean>(true);

  // Estados da Câmera
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInsecureHttp, setIsInsecureHttp] = useState(false);
  const [scannerMode, setScannerMode] = useState<'native' | 'fallback' | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);

  // Estados de Leitura e Cadastro
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [processingCode, setProcessingCode] = useState<string>('');
  const [lastScannedBook, setLastScannedBook] = useState<Partial<Book> | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [recentBooks, setRecentBooks] = useState<Array<{ title: string; code: string; time: string }>>([]);

  // Entrada manual e foto nativa
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showChromeHelp, setShowChromeHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal de Preenchimento Manual quando o livro/ISBN não for reconhecido online
  const [manualBookModal, setManualBookModal] = useState<{
    isOpen: boolean;
    code: string;
    isbn: string;
    title: string;
    author: string;
    publisher: string;
    category: string;
    bookType: string;
    shelf: string;
    quantity: number;
    isSearchingOnline?: boolean;
  } | null>(null);

  // Debug feedback
  const [scanStatus, setScanStatus] = useState<string>('');

  // Refs de controle
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeScanLoopRef = useRef<number | null>(null);
  const containerId = 'mobile-continuous-barcode-scanner';
  const lastScannedCode = useRef<string>('');
  const lastScanTimestamp = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const abortSearchRef = useRef<boolean>(false);

  // === SOUND & HAPTIC ===
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(120);
      }
    } catch (e) {}
  };

  // === CHECK SECURE CONTEXT ===
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setIsInsecureHttp(true);
    }
  }, []);

  // === DEBOUNCED SCAN HANDLER ===
  const handleScanResult = useCallback(
    async (decodedText: string) => {
      // Se já está processando uma consulta ou cadastro, ignora novos scans
      if (isProcessingRef.current) {
        return;
      }

      const now = Date.now();
      const cleanCode = decodedText.trim();

      // Debounce: evita ler o mesmo código duas vezes em menos de 3.5 segundos
      if (cleanCode === lastScannedCode.current && now - lastScanTimestamp.current < 3500) {
        return;
      }

      isProcessingRef.current = true;
      lastScannedCode.current = cleanCode;
      lastScanTimestamp.current = now;

      playBeep();
      triggerHaptic();
      setScanStatus(`✅ Código captado: ${cleanCode}`);
      await handleProcessCode(cleanCode);
    },
    [books, selectedShelf, selectedCategory, selectedType, autoSave]
  );

  // === FOTO COM CÂMERA NATIVA (FALLBACK 100% COMPATÍVEL COM QUALQUER CELULAR) ===
  const handleTriggerPhotoCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setScanStatus('📸 Lendo código de barras da foto...');

    try {
      let detectedCode: string | null = null;

      // 1. Tenta API nativa BarcodeDetector (muito rápida em Android Chrome 83+)
      if (typeof window !== 'undefined' && window.BarcodeDetector) {
        try {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
          });
          const bitmap = await createImageBitmap(file);
          const results = await detector.detect(bitmap);
          if (results && results.length > 0) {
            const sorted = [...results].sort((a, b) => {
              const aIsbn = isLikelyIsbn(a.rawValue) || a.format === 'ean_13';
              const bIsbn = isLikelyIsbn(b.rawValue) || b.format === 'ean_13';
              if (aIsbn && !bIsbn) return -1;
              if (!aIsbn && bIsbn) return 1;
              return 0;
            });
            detectedCode = sorted[0]?.rawValue?.trim() || null;
          }
        } catch (detectorErr) {
          console.warn('BarcodeDetector falhou no arquivo de imagem:', detectorErr);
        }
      }

      // 2. Se não detectou ou API não disponível, usa scanFile do html5-qrcode
      if (!detectedCode) {
        const tempDiv = document.createElement('div');
        tempDiv.id = 'temp-photo-scanner-' + Date.now();
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);

        try {
          const fileScanner = new Html5Qrcode(tempDiv.id, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
            verbose: false,
          });

          const scanResult = await fileScanner.scanFile(file, false);
          detectedCode = scanResult?.trim() || null;
          try {
            await fileScanner.clear();
          } catch (e) {}
        } catch (scanErr) {
          console.warn('html5-qrcode scanFile falhou:', scanErr);
        } finally {
          tempDiv.remove();
        }
      }

      if (detectedCode) {
        playBeep();
        triggerHaptic();
        setScanStatus(`✅ Código detectado na foto: ${detectedCode}`);
        showSuccess(`Código detectado: ${detectedCode}`);
        await handleProcessCode(detectedCode);
      } else {
        setScanStatus('⚠️ Código de barras não encontrado na foto');
        showError('Não conseguimos ler o código de barras nesta foto. Aproxime mais da contracapa do livro e tente novamente, ou digite o ISBN.');
      }
    } catch (err: any) {
      console.error('Erro ao ler foto do código:', err);
      showError('Falha ao processar foto: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // === NATIVE BarcodeDetector SCANNER (Chrome Android 83+) ===
  const startNativeScanner = async () => {
    setCameraError(null);
    setScanStatus('Iniciando câmera de alta definição...');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Câmera ao vivo indisponível nesta conexão local. Use o botão "Fotografar Código" abaixo para escanear com a câmera do celular.');
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: selectedCameraId ? undefined : { ideal: 'environment' },
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
      streamRef.current = stream;

      // Cria video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      videoRef.current = video;

      // Insere no container
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }

      await video.play();

      // Configurações avançadas da lente (foco contínuo e zoom macro)
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

        // Suporte a zoom: afasta o celular para evitar o limite macro e mantém foco nítido
        if (caps?.zoom) {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 5;
          const step = caps.zoom.step || 0.1;
          setZoomCapabilities({ min, max, step });

          // Zoom inicial de 1.3x para leitura confortável a 20cm
          const initialZoom = Math.min(Math.max(1.3, min), Math.min(2.0, max));
          advancedList.push({ zoom: initialZoom });
          setZoomLevel(initialZoom);
        }

        if (advancedList.length > 0) {
          try {
            await videoTrack.applyConstraints({ advanced: advancedList });
          } catch (e) {
            console.warn('Configuração avançada de foco/zoom não suportada:', e);
          }
        }

        // Lista câmeras
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

      // Cria detector nativo
      const detector = new window.BarcodeDetector!({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });

      // Canvas offscreen para fallback se detector direto no elemento de vídeo falhar
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      setScannerMode('native');
      setIsScanning(true);
      setScanStatus('📷 Foco ativo — mantenha o livro a ~20cm');

      // Loop de detecção ultra-rápido (zero-copy GPU acelerado)
      const scanLoop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        try {
          if (!isProcessingRef.current) {
            let barcodes: Array<{ rawValue: string; format: string }> = [];

            // 1. Tenta detecção direta no <video> (rápido e zero-copy)
            try {
              barcodes = await detector.detect(videoRef.current);
            } catch (videoDetectErr) {
              // 2. Fallback com canvas offscreen
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

            if (barcodes && barcodes.length > 0 && !isProcessingRef.current) {
              // Prioriza códigos no formato EAN-13 ou que se pareçam com ISBN
              const sorted = [...barcodes].sort((a, b) => {
                const aIsbn = isLikelyIsbn(a.rawValue) || a.format === 'ean_13';
                const bIsbn = isLikelyIsbn(b.rawValue) || b.format === 'ean_13';
                if (aIsbn && !bIsbn) return -1;
                if (!aIsbn && bIsbn) return 1;
                return 0;
              });

              const selectedCode = sorted[0]?.rawValue?.trim();
              if (selectedCode) {
                await handleScanResult(selectedCode);
              }
            }
          }
        } catch (e) {
          // continua tentando nos próximos frames
        }

        // Throttle balanceado (~35ms = ~28 FPS)
        await new Promise((r) => setTimeout(r, 35));
        nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
      };

      nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.error('Erro ao iniciar scanner nativo:', err);
      setCameraError(err?.message || 'Não foi possível iniciar a câmera.');
      setIsScanning(false);
    }
  };

  // === FALLBACK: html5-qrcode ===
  const startFallbackScanner = async () => {
    setCameraError(null);
    setScanStatus('Iniciando scanner (modo compatibilidade)...');

    try {
      // Lista câmeras
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
        aspectRatio: 1.777, // 16:9 widescreen para maior nitidez
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
            async (decodedText) => {
              if (!isProcessingRef.current) {
                await handleScanResult(decodedText);
              }
            },
            () => {}
          );
          started = true;
          break;
        } catch (attemptErr) {
          lastErr = attemptErr;
          console.warn('Tentativa com fonte de câmera falhou:', camSource, attemptErr);
        }
      }

      if (!started) {
        throw lastErr || new Error('Não foi possível iniciar o vídeo da câmera.');
      }

      setScannerMode('fallback');
      setIsScanning(true);
      setScanStatus('📷 Scanner ativo — aponte para o código de barras');

      // Checa lanterna e zoom
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
      console.error('Erro ao iniciar câmera no coletor:', err);
      setIsScanning(false);
      const isHttpOrInsecure =
        typeof window !== 'undefined' &&
        (!window.isSecureContext || window.location.protocol === 'http:');

      const customMsg = isHttpOrInsecure
        ? 'A câmera contínua foi bloqueada pelo navegador por estar em conexão HTTP local. Toque no botão "Fotografar Código" para usar a câmera nativa do celular (funciona direto) ou libere a câmera nas opções do site no Chrome.'
        : (err?.message || 'Não foi possível ligar a câmera. Verifique se deu permissão no navegador.');

      setCameraError(customMsg);
    }
  };

  // === UNIFIED START ===
  const startCamera = async () => {
    setCameraError(null);

    // Checagem prévia se navigator.mediaDevices está disponível
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'A câmera contínua foi bloqueada pelo navegador por ser uma conexão HTTP local. Toque no botão verde "📸 Fotografar Código" abaixo para escanear usando a câmera nativa do celular!'
      );
      setIsScanning(false);
      return;
    }

    // Tenta usar BarcodeDetector nativo primeiro (Chrome Android 83+)
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        const supported = await (window.BarcodeDetector as any).getSupportedFormats?.();
        if (supported && supported.includes('ean_13')) {
          setScanStatus('Usando scanner nativo acelerado por GPU');
          await startNativeScanner();
          return;
        }
      } catch (e) {
        // Fallback
      }

      try {
        await startNativeScanner();
        return;
      } catch (e) {
        console.warn('Fallback para html5-qrcode:', e);
      }
    }

    // Fallback: html5-qrcode
    setScanStatus('Usando modo compatibilidade');
    await startFallbackScanner();
  };

  // === STOP ALL ===
  const stopCamera = async () => {
    // Para loop nativo
    if (nativeScanLoopRef.current) {
      cancelAnimationFrame(nativeScanLoopRef.current);
      nativeScanLoopRef.current = null;
    }

    // Para stream nativo
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Limpa video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    // Para html5-qrcode
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }

    // Limpa container
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

  // === TORCH ===
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
    } catch (e) {}
  };

  // === ZOOM TOGGLE (1x -> 2x -> 3x -> 1x) ===
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
      console.warn('Erro ao aplicar zoom:', e);
    }
  };

  // === TAP TO FOCUS ===
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

  // === SWITCH CAMERA ===
  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    await stopCamera();
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  useEffect(() => {
    if (selectedCameraId) {
      startCamera();
    }
  }, [selectedCameraId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // === PROCESS SCANNED CODE ===
  const handleProcessCode = async (scannedCode: string) => {
    const isIsbn = isLikelyIsbn(scannedCode);
    setProcessingCode(scannedCode);
    setIsLoadingBook(true);
    abortSearchRef.current = false;

    try {
      // 1. Verifica se livro já existe no banco
      const existing = (books || []).find(
        (b) =>
          b.code?.toUpperCase() === scannedCode.toUpperCase() ||
          (b.isbn && b.isbn.toUpperCase() === scannedCode.toUpperCase())
      );

      if (existing) {
        showInfo(`Livro já cadastrado: "${existing.title}" (Prateleira: ${existing.shelf})`);
        setLastScannedBook({
          ...existing,
          title: `[JÁ CADASTRADO] ${existing.title}`,
        });
        return;
      }

      // 2. Busca dados online se for ISBN
      let fetchedData: any = null;
      if (isIsbn) {
        try {
          fetchedData = await fetchBookDetailsByIsbn(scannedCode);
        } catch (e) {
          console.warn('Erro ao buscar livro online:', e);
        }
      }

      // Se o usuário clicou em pular busca
      if (abortSearchRef.current) {
        fetchedData = null;
      }

      const hasOnlineTitle = Boolean(fetchedData?.title && fetchedData.title.trim().length > 0);

      // CASO 1: ACHAR O LIVRO PELO ISBN NA INTERNET
      if (hasOnlineTitle) {
        const matchedCategory = matchSystemCategory(fetchedData.category, categories) || selectedCategory;
        const matchedType = matchSystemBookType(fetchedData.bookType, bookTypes) || selectedType;
        const title = fetchedData.title.trim().toUpperCase();
        const author = (fetchedData?.author && fetchedData.author.trim().length > 0)
          ? fetchedData.author.trim().toUpperCase()
          : 'AUTOR NÃO INFORMADO';
        const publisher = (fetchedData?.publisher && fetchedData.publisher.trim().length > 0)
          ? fetchedData.publisher.trim().toUpperCase()
          : 'N/A';

        const newBookData: Omit<Book, 'id'> = {
          code: scannedCode.toUpperCase(),
          isbn: isIsbn ? scannedCode : (fetchedData.isbn || ''),
          title,
          author,
          publisher,
          shelf: selectedShelf.toUpperCase(),
          category: matchedCategory.toUpperCase(),
          bookType: matchedType.toUpperCase(),
          quantity: 1,
        };

        setLastScannedBook(newBookData);

        // Se o modo automático estiver ativo, salva direto com todos os dados
        if (autoSave) {
          try {
            await addBook(newBookData);
            setSessionCount((prev) => prev + 1);
            setRecentBooks((prev) => [
              {
                title,
                code: scannedCode,
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              },
              ...prev.slice(0, 4),
            ]);
            showSuccess(`"${title}" cadastrado com sucesso!`);
          } catch (err) {
            showError('Erro ao cadastrar livro no banco.');
          }
        } else {
          showSuccess(`Dados de "${title}" localizados! Toque em Salvar.`);
        }
      } else {
        // CASO 2: NÃO ACHAR OU NÃO RECONHECER O ISBN -> TUDO MANUAL!
        // Não salva dados provisórios como "LIVRO CÓDIGO" e "A DEFINIR"
        stopCamera();
        setManualBookModal({
          isOpen: true,
          code: scannedCode.toUpperCase(),
          isbn: isIsbn ? scannedCode : '',
          title: '',
          author: '',
          publisher: '',
          category: selectedCategory.toUpperCase(),
          bookType: selectedType.toUpperCase(),
          shelf: selectedShelf.toUpperCase(),
          quantity: 1,
        });

        if (isIsbn) {
          showInfo(`ISBN "${scannedCode}" não localizado na internet. Preencha os campos manualmente.`);
        } else {
          showInfo(`Código "${scannedCode}" lido (não é ISBN). Preencha os dados manualmente.`);
        }
      }
    } catch (err: any) {
      console.error('Erro geral no processamento do código:', err);
      showError('Ocorreu um erro ao processar o código lido.');
    } finally {
      setIsLoadingBook(false);
      setProcessingCode('');
      // Delay de 1.5s antes de liberar a leitura do próximo livro
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1500);
    }
  };

  // === BUSCA ISBN ONLINE A PARTIR DO FORMULÁRIO MANUAL ===
  const handleManualModalSearchIsbn = async () => {
    if (!manualBookModal?.isbn?.trim()) {
      showError('Informe um ISBN para consultar online.');
      return;
    }
    const clean = cleanIsbn(manualBookModal.isbn);
    setManualBookModal((prev) => (prev ? { ...prev, isSearchingOnline: true } : null));
    try {
      const details = await fetchBookDetailsByIsbn(clean);
      if (details?.title) {
        const matchedCat = matchSystemCategory(details.category, categories);
        const matchedTyp = matchSystemBookType(details.bookType, bookTypes);
        setManualBookModal((prev) =>
          prev
            ? {
                ...prev,
                title: details.title!.toUpperCase(),
                author: (details.author || '').toUpperCase(),
                publisher: (details.publisher || '').toUpperCase(),
                category: matchedCat,
                bookType: matchedTyp,
                isSearchingOnline: false,
              }
            : null
        );
        showSuccess(`Dados de "${details.title}" localizados online!`);
      } else {
        showInfo('ISBN não localizado na internet. Preencha os dados manualmente.');
        setManualBookModal((prev) => (prev ? { ...prev, isSearchingOnline: false } : null));
      }
    } catch (e) {
      showError('Erro ao buscar ISBN online.');
      setManualBookModal((prev) => (prev ? { ...prev, isSearchingOnline: false } : null));
    }
  };

  // === SALVAR LIVRO DO PREENCHIMENTO MANUAL ===
  const handleSaveManualBook = async () => {
    if (!manualBookModal) return;
    if (!manualBookModal.title.trim()) {
      showError('O título do livro é obrigatório.');
      return;
    }
    if (!manualBookModal.author.trim()) {
      showError('O autor do livro é obrigatório.');
      return;
    }

    const bookData: Omit<Book, 'id'> = {
      code: (manualBookModal.code || '').trim().toUpperCase(),
      isbn: (manualBookModal.isbn || '').trim(),
      title: manualBookModal.title.trim().toUpperCase(),
      author: manualBookModal.author.trim().toUpperCase(),
      publisher: (manualBookModal.publisher || 'N/A').trim().toUpperCase(),
      shelf: (manualBookModal.shelf || selectedShelf).toUpperCase(),
      category: (manualBookModal.category || selectedCategory).toUpperCase(),
      bookType: (manualBookModal.bookType || selectedType).toUpperCase(),
      quantity: manualBookModal.quantity || 1,
    };

    try {
      await addBook(bookData);
      setSessionCount((prev) => prev + 1);
      setRecentBooks((prev) => [
        {
          title: bookData.title,
          code: bookData.code || bookData.isbn,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 4),
      ]);
      setLastScannedBook(bookData);
      showSuccess(`Livro "${bookData.title}" cadastrado com sucesso!`);
      setManualBookModal(null);
      // Retoma câmera automaticamente
      startCamera();
    } catch (err) {
      showError('Erro ao salvar livro no banco.');
    }
  };

  const handleCancelManualModal = () => {
    setManualBookModal(null);
    startCamera();
  };

  // === MANUAL SAVE ===
  const handleManualSave = async () => {
    if (!lastScannedBook || !lastScannedBook.code) return;
    try {
      await addBook({
        code: lastScannedBook.code.toUpperCase(),
        isbn: lastScannedBook.isbn || '',
        title: lastScannedBook.title?.toUpperCase() || 'LIVRO SEM TÍTULO',
        author: lastScannedBook.author?.toUpperCase() || 'N/A',
        publisher: lastScannedBook.publisher?.toUpperCase() || 'N/A',
        shelf: selectedShelf.toUpperCase(),
        category: selectedCategory.toUpperCase(),
        bookType: selectedType.toUpperCase(),
        quantity: 1,
      });
      setSessionCount((prev) => prev + 1);
      setRecentBooks((prev) => [
        {
          title: lastScannedBook.title || 'Novo Livro',
          code: lastScannedBook.code!,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 4),
      ]);
      showSuccess(`Livro cadastrado com sucesso!`);
      setLastScannedBook(null);
    } catch (err) {
      showError('Erro ao salvar livro.');
    }
  };

  // === MANUAL ISBN INPUT ===
  const handleManualIsbnSubmit = async () => {
    const code = manualIsbn.replace(/[\s-]/g, '').trim();
    if (!code || code.length < 10) {
      showError('Digite um código ISBN válido (10 ou 13 dígitos).');
      return;
    }
    setShowManualInput(false);
    setManualIsbn('');
    await handleScanResult(code);
  };

  const httpsUrl =
    typeof window !== 'undefined'
      ? window.location.href.replace('http://', 'https://').replace(':8081', ':8080')
      : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Mobile do Coletor */}
      <header className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              Coletor de Livros
              <Badge variant="outline" className="text-[10px] bg-emerald-950/60 text-emerald-400 border-emerald-700 py-0 px-1.5">
                Multi-Celular
              </Badge>
            </h1>
            <p className="text-[11px] text-slate-400">Escaneie o ISBN na contracapa</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-400 block">Sessão</span>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs">
            {sessionCount} livros
          </Badge>
        </div>
      </header>

      {/* Alerta de HTTP Inseguro se aberto sem HTTPS */}
      {isInsecureHttp && (
        <div className="m-3 p-3 bg-amber-950/80 border border-amber-700 rounded-lg text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Câmera requer HTTPS no celular
          </div>
          <p className="text-slate-300 text-[11px]">
            Para que o Chrome do celular libere a câmera, toque no link seguro abaixo:
          </p>
          <a
            href={httpsUrl}
            className="block text-emerald-400 font-mono text-[11px] underline break-all"
          >
            {httpsUrl}
          </a>
        </div>
      )}

      {/* Barra de Configurações da Prateleira Atual */}
      <div className="bg-slate-900/70 border-b border-slate-800/80 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            Configuração da Coleta Atual:
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-emerald-300 font-medium">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="rounded accent-emerald-500 w-3.5 h-3.5"
            />
            Cadastro Automático 1-Toque
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-slate-400">Prateleira</Label>
            <select
              value={selectedShelf}
              onChange={(e) => setSelectedShelf(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
            >
              {shelves.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-400">Categoria</Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-400">Tipo</Label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
            >
              {bookTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Área da Câmera do Celular */}
      <main className="p-3 flex-1 flex flex-col gap-3">
        <div
          onClick={isScanning ? handleTapToFocus : undefined}
          title={isScanning ? 'Toque para focar a lente' : undefined}
          className={`relative w-full rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-[4/3] flex items-center justify-center shadow-lg transition-all ${
            isScanning ? 'cursor-pointer select-none active:brightness-110' : ''
          }`}
        >
          {/* Container do Scanner (nativo ou html5-qrcode) */}
          <div id={containerId} className="w-full h-full" />

          {/* Mira animada com guia retangular (formato ISBN ~2.4 : 1) */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[88%] h-[38%] border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                {/* Cantos destacados */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Linha vermelha animada */}
                <div
                  className="absolute left-[4%] right-[4%] h-[2.5px] bg-red-500 shadow-[0_0_12px_#ef4444] rounded-full"
                  style={{
                    top: '50%',
                    animation: 'scanline 2s ease-in-out infinite',
                  }}
                />
              </div>

              <div className="flex flex-col items-center mt-2.5 space-y-1">
                <span className="text-[11px] text-emerald-300 font-semibold bg-black/75 px-3 py-1 rounded-full backdrop-blur-md border border-emerald-500/30">
                  Enquadre o código de barras ISBN
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

          {/* Input oculto para acionar a câmera nativa do smartphone sem bloqueio SSL */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapturePhoto}
          />

          {/* Loader de processamento da foto */}
          {isProcessingPhoto && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 p-4 text-center">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-white">Lendo código de barras da foto...</h4>
                <p className="text-[11px] text-slate-300 mt-1">Identificando ISBN na foto capturada</p>
              </div>
            </div>
          )}

          {/* Estado Parado ou Carregando */}
          {!isScanning && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-3 text-center">
              {cameraError ? (
                <div className="space-y-2.5 max-w-sm w-full p-2">
                  <div className="flex items-center justify-center gap-2 text-red-400">
                    <AlertCircle className="w-7 h-7 shrink-0" />
                    <h3 className="text-xs font-bold text-white text-left">
                      Câmera ao vivo bloqueada pelo navegador
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-tight">
                    {cameraError}
                  </p>

                  {/* Ação Primária Recomendada: Câmera Nativa sem bloqueio */}
                  <div className="pt-1 flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={handleTriggerPhotoCapture}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 py-2.5 shadow-md w-full active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      📸 Fotografar Código (Câmera Nativa)
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowManualInput(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 flex-1"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        Digitar ISBN
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startCamera}
                        className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs gap-1.5 flex-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Tentar ao Vivo
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowChromeHelp(!showChromeHelp)}
                      className="text-[10.5px] text-emerald-400 hover:underline flex items-center justify-center gap-1 mt-0.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showChromeHelp ? 'Ocultar instruções do Chrome' : 'Como liberar câmera ao vivo no Chrome Android?'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-w-xs w-full">
                  <Camera className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Pronto para Coletar</h3>
                    <p className="text-[11px] text-slate-400">Escolha a forma que preferir para registrar</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full px-1">
                    <Button
                      onClick={handleTriggerPhotoCapture}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 shadow-lg gap-2 text-xs active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      📸 Fotografar Código (Câmera Nativa)
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={startCamera}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Câmera ao Vivo
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => setShowManualInput(true)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        Digitar ISBN
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loader de busca online do ISBN */}
          {isLoadingBook && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 p-4 text-center">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-white">Buscando dados do livro...</h4>
                {processingCode && (
                  <p className="text-xs font-mono text-emerald-400 mt-1 font-bold">ISBN: {processingCode}</p>
                )}
                <p className="text-[11px] text-slate-300 mt-1">Consultando acervo da CBL e catálogo aberto</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  abortSearchRef.current = true;
                }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 active:scale-95 transition-all"
              >
                Pular busca e cadastrar só o código
              </button>
            </div>
          )}
        </div>

        {/* Card de Ajuda de Permissão do Chrome Android */}
        {showChromeHelp && (
          <Card className="bg-slate-900 border-emerald-800/60 p-3 text-xs space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Info className="w-4 h-4 shrink-0" />
                Como liberar a câmera no Chrome (Celular):
              </div>
              <button
                type="button"
                onClick={() => setShowChromeHelp(false)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
              <li>
                Na barra de endereço onde aparece o IP (ex: <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded">10.0.0.187:8080</code>), toque no ícone à esquerda (ícone de ajustes/sliders ou cadeado).
              </li>
              <li>
                Toque em <strong>Permissões</strong> ou <strong>Configurações do site</strong>.
              </li>
              <li>
                Localize <strong>Câmera</strong> e altere de <em>Bloqueado</em> para <strong>Permitir</strong>.
              </li>
              <li>
                Toque no botão <strong>"Tentar ao Vivo"</strong> para ativar.
              </li>
              <li className="text-emerald-300 font-semibold list-none pt-1">
                ⭐ <em>Melhor opção:</em> Você pode simplesmente tocar em <strong>"📸 Fotografar Código"</strong> que a câmera nativa do celular abre imediatamente e cadastra o livro sem precisar configurar nada!
              </li>
            </ol>
          </Card>
        )}

        {/* Barra de Ações Rápidas (SEMPRE VISÍVEL - Nunca deixa o usuário sem opção) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
          <button
            type="button"
            onClick={handleTriggerPhotoCapture}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
          >
            <Camera className="w-4 h-4" />
            📸 Fotografar Código
          </button>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95"
          >
            <Keyboard className="w-4 h-4 text-blue-200" />
            {showManualInput ? 'Ocultar ISBN' : 'Digitar ISBN'}
          </button>

          {isScanning ? (
            <>
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                    torchEnabled
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  <Flashlight className="w-4 h-4 text-amber-300" />
                  {torchEnabled ? 'Lanterna On' : 'Lanterna'}
                </button>
              )}

              {zoomCapabilities && (
                <button
                  type="button"
                  onClick={toggleZoom}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 shadow-md transition-all active:scale-95"
                >
                  <ZoomIn className="w-4 h-4 text-emerald-400" />
                  Zoom {zoomLevel.toFixed(1)}x
                </button>
              )}

              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-md transition-all active:scale-95"
                >
                  <SwitchCamera className="w-4 h-4 text-emerald-400" />
                  Câmera
                </button>
              )}

              <button
                type="button"
                onClick={stopCamera}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
              >
                Pausar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 shadow-md transition-all active:scale-95 col-span-2 sm:col-span-2"
            >
              <RefreshCw className="w-4 h-4" />
              Ligar Vídeo ao Vivo
            </button>
          )}
        </div>

        {/* Campo de Entrada Manual de ISBN */}
        {showManualInput && (
          <Card className="bg-slate-900 border-slate-700 shadow-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">Digitar ISBN Manualmente</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  placeholder="Ex: 9788535932799"
                  className="bg-slate-800 border-slate-700 text-white text-sm font-mono flex-1"
                  inputMode="numeric"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualIsbnSubmit();
                  }}
                />
                <button
                  type="button"
                  onClick={handleManualIsbnSubmit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md shrink-0 active:scale-95 transition-all"
                >
                  Buscar
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Digite os 13 dígitos do ISBN que está na contracapa do livro
              </p>
            </CardContent>
          </Card>
        )}

        {/* Card do Último Livro Escaneado */}
        {lastScannedBook && (
          <div className="bg-slate-900 border-2 border-emerald-500/70 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-full">
                    {autoSave ? '✓ Cadastrado no Banco' : 'Aguardando Confirmação'}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-white mt-1.5 leading-snug break-words">
                  {lastScannedBook.title}
                </h3>
                <p className="text-xs font-semibold text-emerald-400 mt-1">
                  {lastScannedBook.author || 'Autor não informado'}
                </p>
                {lastScannedBook.publisher && lastScannedBook.publisher !== 'N/A' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Editora: {lastScannedBook.publisher}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {!autoSave && (
                  <button
                    type="button"
                    onClick={handleManualSave}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
                  >
                    Salvar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setManualBookModal({
                      isOpen: true,
                      code: (lastScannedBook.code || '').toUpperCase(),
                      isbn: lastScannedBook.isbn || '',
                      title: lastScannedBook.title?.startsWith('LIVRO CÓDIGO') ? '' : (lastScannedBook.title || ''),
                      author: lastScannedBook.author === 'A DEFINIR' ? '' : (lastScannedBook.author || ''),
                      publisher: lastScannedBook.publisher === 'N/A' ? '' : (lastScannedBook.publisher || ''),
                      shelf: lastScannedBook.shelf || selectedShelf,
                      category: lastScannedBook.category || selectedCategory,
                      bookType: lastScannedBook.bookType || selectedType,
                      quantity: lastScannedBook.quantity || 1,
                    });
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] rounded-lg shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <Edit3 className="w-3 h-3" />
                  Editar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300">
              <span>Código: <strong className="text-white font-mono">{lastScannedBook.isbn || lastScannedBook.code}</strong></span>
              <span>Prateleira: <strong className="text-emerald-400">{lastScannedBook.shelf || selectedShelf}</strong></span>
              <span>Categoria: <strong className="text-white">{lastScannedBook.category || selectedCategory}</strong></span>
            </div>
          </div>
        )}

        {/* Modal de Preenchimento Manual quando o ISBN não é reconhecido online */}
        <Dialog
          open={Boolean(manualBookModal?.isOpen)}
          onOpenChange={(open) => {
            if (!open) handleCancelManualModal();
          }}
        >
          <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-950/60 text-amber-400 border-amber-700 text-xs">
                  Preenchimento Manual
                </Badge>
              </div>
              <DialogTitle className="text-lg text-white">
                Cadastrar Dados do Livro
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                O código bipado não retornou dados online de ISBN. Preencha os campos abaixo para registrar o livro:
              </DialogDescription>
            </DialogHeader>

            {manualBookModal && (
              <div className="space-y-3 py-2 text-xs">
                {/* Código do livro */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold">Código do Livro / Tombamento</Label>
                  <Input
                    value={manualBookModal.code}
                    onChange={(e) =>
                      setManualBookModal((prev) => (prev ? { ...prev, code: e.target.value.toUpperCase() } : null))
                    }
                    className="bg-slate-800 border-slate-700 text-white font-mono uppercase text-sm"
                  />
                </div>

                {/* ISBN com Busca Online */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold">ISBN (Opcional - da contracapa)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualBookModal.isbn}
                      onChange={(e) =>
                        setManualBookModal((prev) => (prev ? { ...prev, isbn: e.target.value } : null))
                      }
                      placeholder="Ex: 9788535902778"
                      className="bg-slate-800 border-slate-700 text-white font-mono text-sm flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualModalSearchIsbn}
                      disabled={manualBookModal.isSearchingOnline}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 shrink-0"
                    >
                      {manualBookModal.isSearchingOnline ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      Buscar
                    </Button>
                  </div>
                </div>

                {/* Título */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold flex items-center justify-between">
                    <span>Título do Livro *</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Obrigatório</span>
                  </Label>
                  <Input
                    value={manualBookModal.title}
                    onChange={(e) =>
                      setManualBookModal((prev) => (prev ? { ...prev, title: e.target.value.toUpperCase() } : null))
                    }
                    placeholder="Ex: DOM CASMURRO"
                    autoFocus
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm"
                  />
                </div>

                {/* Autor */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold flex items-center justify-between">
                    <span>Autor *</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Obrigatório</span>
                  </Label>
                  <Input
                    value={manualBookModal.author}
                    onChange={(e) =>
                      setManualBookModal((prev) => (prev ? { ...prev, author: e.target.value.toUpperCase() } : null))
                    }
                    placeholder="Ex: MACHADO DE ASSIS"
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm"
                  />
                </div>

                {/* Editora */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold">Editora</Label>
                  <Input
                    value={manualBookModal.publisher}
                    onChange={(e) =>
                      setManualBookModal((prev) => (prev ? { ...prev, publisher: e.target.value.toUpperCase() } : null))
                    }
                    placeholder="Ex: ÁTICA, RECORD, N/A"
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm"
                  />
                </div>

                {/* Categoria, Tipo e Prateleira */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-[10px]">Categoria</Label>
                    <select
                      value={manualBookModal.category}
                      onChange={(e) =>
                        setManualBookModal((prev) => (prev ? { ...prev, category: e.target.value } : null))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-[10px]">Tipo</Label>
                    <select
                      value={manualBookModal.bookType}
                      onChange={(e) =>
                        setManualBookModal((prev) => (prev ? { ...prev, bookType: e.target.value } : null))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
                    >
                      {bookTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-[10px]">Prateleira</Label>
                    <select
                      value={manualBookModal.shelf}
                      onChange={(e) =>
                        setManualBookModal((prev) => (prev ? { ...prev, shelf: e.target.value } : null))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
                    >
                      {shelves.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantidade */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px]">Quantidade de Cópias</Label>
                  <Input
                    type="number"
                    min={1}
                    value={manualBookModal.quantity}
                    onChange={(e) =>
                      setManualBookModal((prev) =>
                        prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) } : null
                      )
                    }
                    className="bg-slate-800 border-slate-700 text-white text-sm w-24"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelManualModal}
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveManualBook}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Salvar Livro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Histórico Recente desta Sessão */}
        {recentBooks.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
              Coletados Recentemente:
            </span>
            <div className="space-y-1">
              {recentBooks.map((rb, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate text-slate-200">{rb.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{rb.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CSS para animação da linha de scan */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-80%); }
          50% { transform: translateY(80%); }
        }
      `}</style>
    </div>
  );
};

export default MobileCollectorPage;
