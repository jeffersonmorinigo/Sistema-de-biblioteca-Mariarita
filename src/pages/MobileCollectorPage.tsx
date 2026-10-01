import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { showSuccess, showError, showInfo } from '@/utils/toast';

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

  // Estados de Leitura e Cadastro
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [lastScannedBook, setLastScannedBook] = useState<Partial<Book> | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [recentBooks, setRecentBooks] = useState<Array<{ title: string; code: string; time: string }>>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'mobile-continuous-barcode-scanner';
  const lastScannedCode = useRef<string>('');
  const lastScanTimestamp = useRef<number>(0);

  // Web Audio Bip
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

  useEffect(() => {
    // Verifica contexto seguro
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

  const startCamera = async () => {
    setCameraError(null);
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
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.88),
            height: Math.floor(minEdge * 0.48),
          };
        },
      };

      const cameraSource = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraSource,
        config,
        async (decodedText) => {
          const now = Date.now();
          const cleanCode = decodedText.trim();

          // Debounce: evita ler o mesmo código duas vezes em menos de 3 segundos
          if (cleanCode === lastScannedCode.current && now - lastScanTimestamp.current < 3000) {
            return;
          }

          lastScannedCode.current = cleanCode;
          lastScanTimestamp.current = now;

          playBeep();
          triggerHaptic();
          await handleProcessCode(cleanCode);
        },
        () => {}
      );

      setIsScanning(true);

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

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {}
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
    } catch (e) {}
  };

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

  // Processa o código lido
  const handleProcessCode = async (scannedCode: string) => {
    const isIsbn = isLikelyIsbn(scannedCode);
    setIsLoadingBook(true);

    // 1. Verifica se livro já existe no banco
    const existing = books.find(
      (b) => b.code.toUpperCase() === scannedCode.toUpperCase() || (b.isbn && b.isbn === scannedCode)
    );

    if (existing) {
      setIsLoadingBook(false);
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
      } catch (e) {}
    }

    const title = fetchedData?.title
      ? fetchedData.title.toUpperCase()
      : `LIVRO CÓDIGO ${scannedCode}`;
    const author = fetchedData?.author
      ? fetchedData.author.toUpperCase()
      : 'A DEFINIR';
    const publisher = fetchedData?.publisher
      ? fetchedData.publisher.toUpperCase()
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
        showSuccess(`"${title}" cadastrado com sucesso!`);
      } catch (err) {
        showError('Erro ao cadastrar livro no banco.');
      }
    }

    setIsLoadingBook(false);
  };

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

  const httpsUrl = typeof window !== 'undefined' ? window.location.href.replace('http://', 'https://') : '';

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
          {/* Container Html5Qrcode */}
          <div id={containerId} className="w-full h-full" />

          {/* Mira animada com guia retangular */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[88%] h-[48%] border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_20px_rgba(52,211,153,0.4)] animate-pulse">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_10px_#ef4444]" />
              </div>
              <span className="text-[11px] text-emerald-300 font-semibold mt-2.5 bg-black/70 px-3 py-1 rounded-full backdrop-blur-md">
                Posicione o código de barras ISBN
              </span>
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
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-xs font-medium text-emerald-300">
                Buscando título e autor na internet...
              </span>
            </div>
          )}
        </div>

        {/* Controles de Câmera (Lanterna, Trocar Lente, Parar) */}
        {isScanning && (
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex gap-2">
              {hasTorch && (
                <Button
                  size="sm"
                  variant={torchEnabled ? 'default' : 'outline'}
                  onClick={toggleTorch}
                  className="h-8 text-xs gap-1.5 border-slate-700"
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  {torchEnabled ? 'Lanterna On' : 'Lanterna'}
                </Button>
              )}
              {availableCameras.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={switchCamera}
                  className="h-8 text-xs gap-1.5 border-slate-700"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  Trocar Câmera
                </Button>
              )}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={stopCamera}
              className="h-8 text-xs text-slate-300"
            >
              Pausar Câmera
            </Button>
          </div>
        )}

        {/* Card do Último Livro Escaneado */}
        {lastScannedBook && (
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="bg-emerald-950/50 text-emerald-400 border-emerald-800 text-[10px]">
                    Último Livro Lido
                  </Badge>
                  <h4 className="font-bold text-sm text-white mt-1 leading-snug line-clamp-2">
                    {lastScannedBook.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lastScannedBook.author || 'Autor desconhecido'}
                  </p>
                </div>
                {autoSave ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                ) : (
                  <Button
                    size="sm"
                    onClick={handleManualSave}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                  >
                    Salvar
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                <span>ISBN: <strong className="text-slate-200 font-mono">{lastScannedBook.isbn || lastScannedBook.code}</strong></span>
                <span>Prat: <strong className="text-emerald-400">{lastScannedBook.shelf || selectedShelf}</strong></span>
                <span>Cat: <strong className="text-slate-200">{lastScannedBook.category || selectedCategory}</strong></span>
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
};

export default MobileCollectorPage;
