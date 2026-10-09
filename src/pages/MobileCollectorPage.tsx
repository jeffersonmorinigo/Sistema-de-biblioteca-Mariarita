import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { useSettings } from '@/hooks/useSettings';
import { Book } from '@/lib/types';
import {
  fetchBookDetailsByIsbn,
  isLikelyIsbn,
  cleanIsbn,
  matchSystemCategory,
  matchSystemBookType,
} from '@/lib/isbnService';
import { decodeBarcodeFromImage, decodeVideoFrame, extractRealIsbn } from '@/lib/barcodeReader';
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
  Check,
  Zap,
} from 'lucide-react';
import { showSuccess, showError, showInfo } from '@/utils/toast';

export const MobileCollectorPage: React.FC = () => {
  const { data: books, add: addBook } = useFirestore<Book>('books');
  const { settings } = useSettings();

  const categories = settings.book_categories || ['LITERATURA', 'DIDÁTICO', 'INFANTIL', 'GERAL'];
  const shelves = settings.book_shelves || ['P1', 'P2', 'P3', 'A1', 'A2', 'B1'];
  const bookTypes = settings.book_types || ['LIVRO', 'REVISTA', 'GIBI'];

  // Configurações da Coleta
  const [selectedShelf, setSelectedShelf] = useState<string>(shelves[0] || 'P1');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'LITERATURA');
  const [selectedType, setSelectedType] = useState<string>(bookTypes[0] || 'LIVRO');
  const [autoSave, setAutoSave] = useState<boolean>(true);

  // Estados da Câmera ao Vivo
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInsecureHttp, setIsInsecureHttp] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.3);
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
  const [photoStepMessage, setPhotoStepMessage] = useState('');
  const [showChromeHelp, setShowChromeHelp] = useState(false);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);

  // Modal de Preenchimento Manual quando o ISBN não for reconhecido online
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

  // Feedback de status da detecção
  const [scanStatus, setScanStatus] = useState<string>('');

  // Refs de controle
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveScanLoopRef = useRef<number | null>(null);
  const containerId = 'mobile-continuous-barcode-scanner';
  const lastScannedCode = useRef<string>('');
  const lastScanTimestamp = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const abortSearchRef = useRef<boolean>(false);

  // Sons e vibração
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

  // Verifica se está em contexto HTTP inseguro
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

  // Processamento do código lido
  const handleScanResult = useCallback(
    async (decodedText: string) => {
      if (isProcessingRef.current) return;

      const now = Date.now();
      const cleanCode = extractRealIsbn(decodedText);

      // Debounce: evita escanear o mesmo livro duas vezes em menos de 3.5 segundos
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

  // === FOTO PELA CÂMERA NATIVA (100% compatível com qualquer celular) ===
  const handleTriggerCameraCapture = () => {
    if (fileInputCameraRef.current) {
      fileInputCameraRef.current.value = '';
      fileInputCameraRef.current.click();
    }
  };

  const handleTriggerGalleryCapture = () => {
    if (fileInputGalleryRef.current) {
      fileInputGalleryRef.current.value = '';
      fileInputGalleryRef.current.click();
    }
  };

  const handleProcessImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoStepMessage('Carregando foto em alta definição...');

    try {
      const detectedCode = await decodeBarcodeFromImage(file, (step) => {
        setPhotoStepMessage(step);
      });

      if (detectedCode) {
        playBeep();
        triggerHaptic();
        setScanStatus(`✅ Código detectado na foto: ${detectedCode}`);
        showSuccess(`Código detectado: ${detectedCode}`);
        await handleProcessCode(detectedCode);
      } else {
        setScanStatus('⚠️ Código de barras não encontrado na foto');
        showError(
          'Não conseguimos ler o código de barras nesta foto. Aproxime mais da contracapa do livro (a ~15-20cm) com boa luz e tente novamente.'
        );
      }
    } catch (err: any) {
      console.error('Erro ao processar foto:', err);
      showError('Falha ao processar foto: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsProcessingPhoto(false);
      setPhotoStepMessage('');
    }
  };

  // === CÂMERA AO VIVO COM FOCO CONTÍNUO E ZOOM MACRO ===
  const startLiveCamera = async () => {
    setCameraError(null);
    setScanStatus('Iniciando câmera ao vivo...');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Câmera ao vivo contínua requer conexão HTTPS no celular. Use o botão "📸 Fotografar Código" para ler com a câmera nativa com máxima precisão!'
        );
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
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      streamRef.current = stream;

      // Elemento de vídeo
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

      // Ajuste de lente, foco e zoom
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const caps = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (caps?.torch) setHasTorch(true);

        const advancedList: any[] = [];
        if (caps?.focusMode?.includes('continuous')) {
          advancedList.push({ focusMode: 'continuous' });
        }

        if (caps?.zoom) {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 5;
          const step = caps.zoom.step || 0.1;
          setZoomCapabilities({ min, max, step });
          const initialZoom = Math.min(Math.max(1.3, min), Math.min(2.0, max));
          advancedList.push({ zoom: initialZoom });
          setZoomLevel(initialZoom);
        }

        if (advancedList.length > 0) {
          try {
            await videoTrack.applyConstraints({ advanced: advancedList });
          } catch (e) {}
        }

        // Câmeras disponíveis
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({ id: d.deviceId, label: d.label || `Câmera ${d.deviceId.slice(0, 6)}` }));
          if (videoDevices.length > 0) {
            setAvailableCameras(videoDevices);
          }
        } catch (e) {}
      }

      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      setIsScanning(true);
      setScanStatus('📷 Foco ativo — mantenha o código no centro');

      // Loop de leitura em tempo real
      const scanLoop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          liveScanLoopRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        try {
          if (!isProcessingRef.current && canvasRef.current) {
            const detectedCode = await decodeVideoFrame(videoRef.current, canvasRef.current);
            if (detectedCode && !isProcessingRef.current) {
              await handleScanResult(detectedCode);
            }
          }
        } catch (e) {
          // Continua nos próximos frames
        }

        await new Promise((r) => setTimeout(r, 45));
        liveScanLoopRef.current = requestAnimationFrame(scanLoop);
      };

      liveScanLoopRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.error('Erro ao iniciar câmera ao vivo:', err);
      setIsScanning(false);
      setCameraError(
        err?.message ||
          'Não foi possível abrir a câmera ao vivo. Use o botão "📸 Fotografar Código" que funciona diretamente!'
      );
    }
  };

  // Parar câmera ao vivo
  const stopLiveCamera = () => {
    if (liveScanLoopRef.current) {
      cancelAnimationFrame(liveScanLoopRef.current);
      liveScanLoopRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    setIsScanning(false);
    setTorchEnabled(false);
    setHasTorch(false);
    setZoomCapabilities(null);
    setZoomLevel(1.3);
    setScanStatus('');
  };

  // Lanterna
  const toggleTorch = async () => {
    try {
      const nextState = !torchEnabled;
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setTorchEnabled(nextState);
      }
    } catch (e) {}
  };

  // Alternar Zoom
  const toggleZoom = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    const min = zoomCapabilities?.min || 1;
    const max = zoomCapabilities?.max || 4;

    let nextZoom = 1;
    if (zoomLevel < 1.4) {
      nextZoom = Math.min(1.8, max);
    } else if (zoomLevel < 2.4 && max >= 2.5) {
      nextZoom = Math.min(2.8, max);
    } else {
      nextZoom = min;
    }

    try {
      if (track) {
        await track.applyConstraints({ advanced: [{ zoom: nextZoom } as any] });
      }
      setZoomLevel(nextZoom);
      setScanStatus(`🔍 Zoom ${nextZoom.toFixed(1)}x`);
      triggerHaptic();
    } catch (e) {}
  };

  // Toque para Focar
  const handleTapToFocus = async () => {
    triggerHaptic();
    setScanStatus('🎯 Focando...');
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
      }
    } catch (e) {}
    setTimeout(() => {
      setScanStatus('📷 Foco nítido ativo');
    }, 1000);
  };

  // Alternar Câmera
  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    stopLiveCamera();
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  useEffect(() => {
    if (selectedCameraId && isScanning) {
      startLiveCamera();
    }
  }, [selectedCameraId]);

  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, []);

  // === PROCESSAMENTO DO CÓDIGO E BUSCA DE ISBN ===
  const handleProcessCode = async (scannedCode: string) => {
    const isIsbn = isLikelyIsbn(scannedCode);
    setProcessingCode(scannedCode);
    setIsLoadingBook(true);
    abortSearchRef.current = false;

    try {
      // 1. Verifica se o livro já existe no acervo
      const existing = (books || []).find(
        (b) =>
          b.code?.toUpperCase() === scannedCode.toUpperCase() ||
          (b.isbn && cleanIsbn(b.isbn).toUpperCase() === cleanIsbn(scannedCode).toUpperCase())
      );

      if (existing) {
        showInfo(`Livro já cadastrado: "${existing.title}" (Prateleira: ${existing.shelf})`);
        setLastScannedBook({
          ...existing,
          title: `[JÁ CADASTRADO] ${existing.title}`,
        });
        return;
      }

      // 2. Busca dados online (BrasilAPI / Google Books / OpenLibrary)
      let fetchedData: any = null;
      if (isIsbn) {
        try {
          fetchedData = await fetchBookDetailsByIsbn(scannedCode);
        } catch (e) {
          console.warn('Erro ao buscar livro online:', e);
        }
      }

      if (abortSearchRef.current) {
        fetchedData = null;
      }

      const hasOnlineTitle = Boolean(fetchedData?.title && fetchedData.title.trim().length > 0);

      // CASO 1: ENCONTROU O LIVRO ONLINE PELO ISBN
      if (hasOnlineTitle) {
        const matchedCategory = matchSystemCategory(fetchedData.category, categories) || selectedCategory;
        const matchedType = matchSystemBookType(fetchedData.bookType, bookTypes) || selectedType;
        const title = fetchedData.title.trim().toUpperCase();
        const author =
          fetchedData?.author && fetchedData.author.trim().length > 0
            ? fetchedData.author.trim().toUpperCase()
            : 'AUTOR NÃO INFORMADO';
        const publisher =
          fetchedData?.publisher && fetchedData.publisher.trim().length > 0
            ? fetchedData.publisher.trim().toUpperCase()
            : 'N/A';

        const newBookData: Omit<Book, 'id'> = {
          code: scannedCode.toUpperCase(),
          isbn: isIsbn ? cleanIsbn(scannedCode) : fetchedData.isbn || '',
          title,
          author,
          publisher,
          shelf: selectedShelf.toUpperCase(),
          category: matchedCategory.toUpperCase(),
          bookType: matchedType.toUpperCase(),
          quantity: 1,
        };

        setLastScannedBook(newBookData);

        // Se o modo automático estiver ativo, salva direto
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
        // CASO 2: ISBN NÃO ENCONTRADO ONLINE OU CÓDIGO INTERNO
        stopLiveCamera();
        setManualBookModal({
          isOpen: true,
          code: scannedCode.toUpperCase(),
          isbn: isIsbn ? cleanIsbn(scannedCode) : '',
          title: '',
          author: '',
          publisher: '',
          category: selectedCategory.toUpperCase(),
          bookType: selectedType.toUpperCase(),
          shelf: selectedShelf.toUpperCase(),
          quantity: 1,
        });

        if (isIsbn) {
          showInfo(`ISBN "${scannedCode}" não localizado na internet. Preencha os campos para salvar.`);
        } else {
          showInfo(`Código "${scannedCode}" capturado. Preencha os campos para salvar.`);
        }
      }
    } catch (err: any) {
      console.error('Erro no processamento do código:', err);
      showError('Ocorreu um erro ao processar o código lido.');
    } finally {
      setIsLoadingBook(false);
      setProcessingCode('');
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1500);
    }
  };

  // Busca ISBN no modal manual
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

  // Salvar livro manual
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
    } catch (err) {
      showError('Erro ao salvar livro no banco.');
    }
  };

  const handleCancelManualModal = () => {
    setManualBookModal(null);
  };

  // Salvar livro manualmente caso o autoSave esteja desativado
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

  // Submissão de ISBN digitado
  const handleManualIsbnSubmit = async () => {
    const code = cleanIsbn(manualIsbn);
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
      ? window.location.href.replace('http://', 'https://')
      : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Mobile do Coletor */}
      <header className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              Coletor de Livros
              <Badge variant="outline" className="text-[10px] bg-emerald-950/60 text-emerald-400 border-emerald-700 py-0 px-1.5">
                Multi-Celular
              </Badge>
            </h1>
            <p className="text-[11px] text-slate-400">Leitura de Código de Barras & ISBN</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-medium">Sessão</span>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5">
            {sessionCount} livros
          </Badge>
        </div>
      </header>

      {/* Alerta amigável de HTTPS apenas se tentar a câmera ao vivo */}
      {isInsecureHttp && !isScanning && (
        <div className="mx-3 mt-3 p-2.5 bg-slate-900/90 border border-emerald-800/60 rounded-xl text-xs flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 text-[11.5px]">
            <Zap className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Dica:</strong> A opção <strong>"Fotografar Código"</strong> funciona perfeitamente em qualquer conexão!
            </span>
          </div>
        </div>
      )}

      {/* Barra de Configurações da Coleta */}
      <div className="bg-slate-900/80 border-b border-slate-800 p-3 space-y-2.5 text-xs shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] flex items-center gap-1 font-semibold">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Configuração da Coleta:
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-emerald-300 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/50">
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
            <Label className="text-[10px] text-slate-400 font-medium">Prateleira</Label>
            <select
              value={selectedShelf}
              onChange={(e) => setSelectedShelf(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {shelves.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-400 font-medium">Categoria</Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-400 font-medium">Tipo</Label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
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

      {/* Inputs ocultos para captura da câmera nativa e galeria */}
      <input
        ref={fileInputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleProcessImageFile}
      />
      <input
        ref={fileInputGalleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleProcessImageFile}
      />

      {/* Conteúdo Principal */}
      <main className="p-3 flex-1 flex flex-col gap-3">
        {/* Painel da Câmera ou Central de Ações */}
        <div
          onClick={isScanning ? handleTapToFocus : undefined}
          className={`relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-all ${
            isScanning ? 'aspect-[4/3] cursor-pointer' : 'p-4'
          }`}
        >
          {/* Container do Vídeo ao Vivo */}
          <div
            id={containerId}
            className={`w-full h-full ${isScanning ? 'block' : 'hidden'}`}
          />

          {/* Mira animada do leitor ao vivo */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[88%] h-[38%] border-2 border-emerald-400 rounded-xl relative shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                {/* Cantos da mira */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Laser de leitura */}
                <div
                  className="absolute left-[3%] right-[3%] h-[2.5px] bg-emerald-400 shadow-[0_0_12px_#10b981] rounded-full"
                  style={{
                    top: '50%',
                    animation: 'scanline 1.8s ease-in-out infinite',
                  }}
                />
              </div>

              <div className="flex flex-col items-center mt-2.5 space-y-1">
                <span className="text-[11px] text-emerald-300 font-bold bg-black/80 px-3 py-1 rounded-full backdrop-blur-md border border-emerald-500/40">
                  Aponte para o código de barras
                </span>
                <span className="text-[9.5px] text-slate-300 bg-black/70 px-2 py-0.5 rounded-full">
                  Distância: ~15 a 20cm • Toque para focar
                </span>
              </div>
            </div>
          )}

          {/* Controles Flutuantes da Câmera ao Vivo */}
          {isScanning && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10">
              <div className="flex items-center gap-1.5">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                      torchEnabled
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                        : 'bg-black/70 text-slate-200 border border-slate-700 hover:bg-black/90'
                    }`}
                    title="Ligar Lanterna"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}

                {zoomCapabilities && (
                  <button
                    type="button"
                    onClick={toggleZoom}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-black/70 text-emerald-300 border border-emerald-500/40 shadow-md hover:bg-black/90 flex items-center gap-1"
                    title="Alternar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    {zoomLevel.toFixed(1)}x
                  </button>
                )}

                {availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-2 rounded-xl text-xs font-bold bg-black/70 text-slate-200 border border-slate-700 hover:bg-black/90"
                    title="Trocar Câmera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 transition-all"
              >
                Parar Vídeo
              </button>
            </div>
          )}

          {/* Central de Ações quando a Câmera ao Vivo NÃO está rodando */}
          {!isScanning && (
            <div className="space-y-4 text-center py-2">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-inner">
                  <Camera className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white">Leitor de Códigos de Livros</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Posicione a contracapa do livro para ler o código
                </p>
              </div>

              {/* Erro de Câmera ao Vivo (se houver) */}
              {cameraError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-left text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    Câmera ao vivo indisponível
                  </div>
                  <p className="text-slate-300 text-[11px] leading-tight">
                    {cameraError}
                  </p>
                </div>
              )}

              {/* Botões de Ação Principais (sem duplicação) */}
              <div className="space-y-2.5">
                {/* BOTÃO 1: FOTOGRAFAR (Câmera Nativa) */}
                <Button
                  onClick={handleTriggerCameraCapture}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-6 rounded-2xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span>📸 Fotografar Código (Câmera do Celular)</span>
                </Button>

                {/* BOTÃO 2 E 3: Câmera ao Vivo e Digitar ISBN */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={startLiveCamera}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-xs py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    Câmera ao Vivo
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-blue-200" />
                    Digitar ISBN
                  </Button>
                </div>

                {/* Botão de Galeria de Fotos */}
                <button
                  type="button"
                  onClick={handleTriggerGalleryCapture}
                  className="text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 mx-auto pt-1 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Escolher foto da galeria do celular</span>
                </button>
              </div>
            </div>
          )}

          {/* Loader de Processamento da Foto */}
          {isProcessingPhoto && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 p-4 text-center">
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-white">Processando Foto do Livro...</h4>
                <p className="text-xs text-emerald-400 mt-1 font-medium">{photoStepMessage || 'Identificando código de barras...'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Multi-mecanismo: ZXing & Quagga2 ativo</p>
              </div>
            </div>
          )}

          {/* Loader de Busca Online do ISBN */}
          {isLoadingBook && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 p-4 text-center">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-white">Consultando Dados do Livro...</h4>
                {processingCode && (
                  <p className="text-xs font-mono text-emerald-400 mt-1 font-bold">
                    Código: {processingCode}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Buscando na Câmara Brasileira do Livro e Google Books...
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  abortSearchRef.current = true;
                }}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 active:scale-95 transition-all"
              >
                Pular busca e cadastrar só o código
              </button>
            </div>
          )}
        </div>

        {/* Campo de Entrada Manual de ISBN */}
        {showManualInput && (
          <Card className="bg-slate-900 border-slate-800 shadow-lg rounded-2xl">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Digitar ISBN Manualmente</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  placeholder="Ex: 9788535902778"
                  className="bg-slate-800 border-slate-700 text-white text-sm font-mono flex-1 rounded-xl"
                  inputMode="numeric"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualIsbnSubmit();
                  }}
                />
                <Button
                  type="button"
                  onClick={handleManualIsbnSubmit}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md px-4 shrink-0 active:scale-95 transition-all"
                >
                  Buscar
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">
                Digite os 10 ou 13 dígitos do ISBN impresso na contracapa ou ficha catalográfica.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Card do Último Livro Cadastrado / Escaneado */}
        {lastScannedBook && (
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-full inline-block">
                  {autoSave ? '✓ Salvo no Acervo' : 'Aguardando Salvar'}
                </span>
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
                  <Button
                    size="sm"
                    onClick={handleManualSave}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md px-3.5"
                  >
                    Salvar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    stopLiveCamera();
                    setManualBookModal({
                      isOpen: true,
                      code: (lastScannedBook.code || '').toUpperCase(),
                      isbn: lastScannedBook.isbn || '',
                      title: lastScannedBook.title?.startsWith('[JÁ CADASTRADO]')
                        ? lastScannedBook.title.replace('[JÁ CADASTRADO]', '').trim()
                        : lastScannedBook.title || '',
                      author: lastScannedBook.author === 'A DEFINIR' ? '' : lastScannedBook.author || '',
                      publisher: lastScannedBook.publisher === 'N/A' ? '' : lastScannedBook.publisher || '',
                      shelf: lastScannedBook.shelf || selectedShelf,
                      category: lastScannedBook.category || selectedCategory,
                      bookType: lastScannedBook.bookType || selectedType,
                      quantity: lastScannedBook.quantity || 1,
                    });
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-[11px] rounded-xl flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Editar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300">
              <span>
                ISBN: <strong className="text-white font-mono">{lastScannedBook.isbn || lastScannedBook.code}</strong>
              </span>
              <span>
                Prateleira: <strong className="text-emerald-400">{lastScannedBook.shelf || selectedShelf}</strong>
              </span>
              <span>
                Categoria: <strong className="text-white">{lastScannedBook.category || selectedCategory}</strong>
              </span>
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
          <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-950/60 text-amber-400 border-amber-700 text-xs">
                  Preenchimento Manual
                </Badge>
              </div>
              <DialogTitle className="text-lg text-white">Cadastrar Livro</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                O código bipado não retornou dados automáticos da internet. Digite o título e autor para registrar:
              </DialogDescription>
            </DialogHeader>

            {manualBookModal && (
              <div className="space-y-3 py-2 text-xs">
                {/* Código do livro */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold">Código / Tombamento</Label>
                  <Input
                    value={manualBookModal.code}
                    onChange={(e) =>
                      setManualBookModal((prev) => (prev ? { ...prev, code: e.target.value.toUpperCase() } : null))
                    }
                    className="bg-slate-800 border-slate-700 text-white font-mono uppercase text-sm rounded-xl"
                  />
                </div>

                {/* ISBN com Busca Online */}
                <div className="space-y-1">
                  <Label className="text-slate-300 text-[11px] font-semibold">ISBN (da contracapa)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualBookModal.isbn}
                      onChange={(e) =>
                        setManualBookModal((prev) => (prev ? { ...prev, isbn: e.target.value } : null))
                      }
                      placeholder="Ex: 9788535902778"
                      className="bg-slate-800 border-slate-700 text-white font-mono text-sm flex-1 rounded-xl"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualModalSearchIsbn}
                      disabled={manualBookModal.isSearchingOnline}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 shrink-0 rounded-xl"
                    >
                      {manualBookModal.isSearchingOnline ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      Buscar Online
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
                    placeholder="Ex: O PEQUENO PRÍNCIPE"
                    autoFocus
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm rounded-xl"
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
                    placeholder="Ex: ANTOINE DE SAINT-EXUPÉRY"
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm rounded-xl"
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
                    placeholder="Ex: AGIR, ÁTICA, RECORD"
                    className="bg-slate-800 border-slate-700 text-white uppercase text-sm rounded-xl"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
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
                  <Label className="text-slate-300 text-[11px]">Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={manualBookModal.quantity}
                    onChange={(e) =>
                      setManualBookModal((prev) =>
                        prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) } : null
                      )
                    }
                    className="bg-slate-800 border-slate-700 text-white text-sm w-24 rounded-xl"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelManualModal}
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveManualBook}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
              >
                Salvar Livro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Histórico Recente desta Sessão */}
        {recentBooks.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Coletados Nesta Sessão:
            </span>
            <div className="space-y-1.5">
              {recentBooks.map((rb, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-sm"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate text-slate-200 font-medium">{rb.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{rb.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CSS para linha de scan */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-70%); }
          50% { transform: translateY(70%); }
        }
      `}</style>
    </div>
  );
};

export default MobileCollectorPage;
