import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useFirestore } from '@/hooks/useFirestore';
import { useSettings } from '@/hooks/useSettings';
import { Book } from '@/lib/types';
import { fetchBookDetailsByIsbn, isLikelyIsbn } from '@/lib/isbnService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

  // Estados de Leitura e Cadastro
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [processingCode, setProcessingCode] = useState<string>('');
  const [lastScannedBook, setLastScannedBook] = useState<Partial<Book> | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [recentBooks, setRecentBooks] = useState<Array<{ title: string; code: string; time: string }>>([]);

  // Entrada manual
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');

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

  // === NATIVE BarcodeDetector SCANNER (Chrome Android 83+) ===
  const startNativeScanner = async () => {
    setCameraError(null);
    setScanStatus('Iniciando câmera nativa...');

    try {
      // Tenta câmera traseira com exact (forçado), se falhar tenta sem exact
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
      } catch (exactErr) {
        // Fallback: sem 'exact' para celulares que não suportam
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

      // Cria canvas offscreen para captura de frames
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      // Cria detector
      const detector = new window.BarcodeDetector!({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });

      // Checa torch
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const caps = videoTrack.getCapabilities?.() as any;
        if (caps?.torch) {
          setHasTorch(true);
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

      setScannerMode('native');
      setIsScanning(true);
      setScanStatus('📷 Scanner nativo ativo — aponte para o código de barras');

      // Loop de escaneamento: 15 FPS
      const scanLoop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          nativeScanLoopRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        try {
          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;

          if (vw > 0 && vh > 0) {
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, vw, vh);

              if (!isProcessingRef.current) {
                const barcodes = await detector.detect(canvas);
                if (barcodes.length > 0 && !isProcessingRef.current) {
                  const code = barcodes[0].rawValue;
                  if (code) {
                    await handleScanResult(code);
                  }
                }
              }
            }
          }
        } catch (e) {
          // continua tentando
        }

        // ~15fps throttle
        await new Promise((r) => setTimeout(r, 66));
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
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Área de scan maior para melhor detecção
          return {
            width: Math.floor(viewfinderWidth * 0.92),
            height: Math.floor(viewfinderHeight * 0.60),
          };
        },
        aspectRatio: 1.777,  // 16:9 para melhor resolução
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,  // usa API nativa se disponível internamente
        },
      };

      const cameraSource = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: { exact: 'environment' } };

      await html5QrCode.start(
        cameraSource,
        config as any,
        async (decodedText) => {
          if (!isProcessingRef.current) {
            await handleScanResult(decodedText);
          }
        },
        () => {}
      );

      setScannerMode('fallback');
      setIsScanning(true);
      setScanStatus('📷 Scanner ativo — aponte para o código de barras');

      // Checa lanterna
      try {
        const runningTrack = (html5QrCode as any).getRunningTrackCapabilities?.();
        if (runningTrack && runningTrack.torch) {
          setHasTorch(true);
        }
      } catch (e) {}
    } catch (err: any) {
      console.error('Erro ao iniciar câmera no coletor:', err);
      setIsScanning(false);
      setCameraError(
        err?.message ||
          'Não foi possível ligar a câmera. Verifique se deu permissão no navegador.'
      );
    }
  };

  // === UNIFIED START ===
  const startCamera = async () => {
    setCameraError(null);

    // Tenta usar BarcodeDetector nativo primeiro (Chrome Android 83+)
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        // Verifica se suporta os formatos que precisamos
        const supported = await (window.BarcodeDetector as any).getSupportedFormats?.();
        if (supported && supported.includes('ean_13')) {
          setScanStatus('Usando scanner nativo de alta performance');
          await startNativeScanner();
          return;
        }
      } catch (e) {
        // BarcodeDetector existe mas não suporta, fallback
      }

      // Tenta mesmo sem verificar formatos
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
      const title = hasOnlineTitle
        ? fetchedData.title.trim().toUpperCase()
        : `LIVRO CÓDIGO ${scannedCode}`;
      const author = fetchedData?.author && fetchedData.author.trim().length > 0
        ? fetchedData.author.trim().toUpperCase()
        : (hasOnlineTitle ? 'AUTOR NÃO INFORMADO' : 'A DEFINIR');
      const publisher = fetchedData?.publisher && fetchedData.publisher.trim().length > 0
        ? fetchedData.publisher.trim().toUpperCase()
        : 'N/A';

      const newBookData: Omit<Book, 'id'> = {
        code: scannedCode.toUpperCase(),
        isbn: isIsbn ? scannedCode : '',
        title,
        author,
        publisher,
        shelf: selectedShelf.toUpperCase(),
        category: selectedCategory.toUpperCase(),
        bookType: selectedType.toUpperCase(),
        quantity: 1,
      };

      setLastScannedBook(newBookData);

      // 3. Salva automaticamente no banco (Modo Rápido)
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
          if (hasOnlineTitle) {
            showSuccess(`"${title}" cadastrado com sucesso!`);
          } else {
            showSuccess(`Código ${scannedCode} cadastrado com sucesso!`);
          }
        } catch (err) {
          showError('Erro ao cadastrar livro no banco.');
        }
      } else {
        if (hasOnlineTitle) {
          showSuccess(`Dados de "${title}" localizados! Toque em Salvar.`);
        } else {
          showInfo(`Código ${scannedCode} lido! Toque em Salvar.`);
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
        <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-[4/3] flex items-center justify-center shadow-lg">
          {/* Container do Scanner (nativo ou html5-qrcode) */}
          <div id={containerId} className="w-full h-full" />

          {/* Mira animada com guia retangular */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[92%] h-[55%] border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                {/* Cantos destacados */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Linha vermelha animada */}
                <div
                  className="absolute left-[5%] right-[5%] h-[3px] bg-red-500 shadow-[0_0_12px_#ef4444] rounded-full"
                  style={{
                    top: '50%',
                    animation: 'scanline 2s ease-in-out infinite',
                  }}
                />
              </div>
              <span className="text-[11px] text-emerald-300 font-semibold mt-2.5 bg-black/70 px-3 py-1 rounded-full backdrop-blur-md">
                Posicione o código de barras ISBN
              </span>
              {scanStatus && (
                <span className="text-[9px] text-slate-400 mt-1 bg-black/50 px-2 py-0.5 rounded-full">
                  {scanStatus}
                </span>
              )}
            </div>
          )}

          {/* Estado Parado ou Carregando */}
          {!isScanning && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
              {cameraError ? (
                <div className="space-y-3 max-w-xs">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                  <p className="text-xs text-red-200">{cameraError}</p>
                  <Button
                    size="sm"
                    onClick={startCamera}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tentar Novamente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Camera className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Pronto para Coletar</h3>
                    <p className="text-[11px] text-slate-400">Toque abaixo para ativar a câmera</p>
                  </div>
                  <Button
                    onClick={startCamera}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 shadow-lg gap-2 text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    Ligar Câmera e Escanear
                  </Button>
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

        {/* Controles de Câmera (Lanterna, Trocar Lente, Parar, Digitar Manual) */}
        {isScanning && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                  torchEnabled
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                }`}
              >
                <Flashlight className="w-4 h-4 text-amber-300" />
                {torchEnabled ? 'Lanterna Ligada' : 'Ligar Lanterna'}
              </button>
            )}

            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-md transition-all active:scale-95"
              >
                <SwitchCamera className="w-4 h-4 text-emerald-400" />
                Trocar Câmera
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95"
            >
              <Keyboard className="w-4 h-4 text-blue-200" />
              Digitar ISBN
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
            >
              Pausar Câmera
            </button>
          </div>
        )}

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
              {!autoSave && (
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shrink-0 active:scale-95 transition-all"
                >
                  Salvar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300">
              <span>Código: <strong className="text-white font-mono">{lastScannedBook.isbn || lastScannedBook.code}</strong></span>
              <span>Prateleira: <strong className="text-emerald-400">{lastScannedBook.shelf || selectedShelf}</strong></span>
              <span>Categoria: <strong className="text-white">{lastScannedBook.category || selectedCategory}</strong></span>
            </div>
          </div>
        )}

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
