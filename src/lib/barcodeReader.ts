import {
  BrowserMultiFormatReader,
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
import Quagga from '@ericblade/quagga2';

/**
 * Utilitários para extração e limpeza de ISBN / EAN
 */

export function cleanCodeString(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[\r\n\t]/g, '').trim();
}

/**
 * Converte ISBN-10 para ISBN-13
 */
export function isbn10ToIsbn13(isbn10: string): string {
  const clean = isbn10.replace(/[^0-9X]/gi, '').toUpperCase();
  if (clean.length !== 10) return isbn10;

  const core = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit;
}

/**
 * Converte ISBN-13 (iniciado em 978) para ISBN-10
 */
export function isbn13ToIsbn10(isbn13: string): string | null {
  const clean = isbn13.replace(/[^0-9]/g, '');
  if (clean.length !== 13 || !clean.startsWith('978')) return null;

  const core = clean.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const rem = sum % 11;
  const check = (11 - rem) % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return core + checkChar;
}

/**
 * Extrai o código ISBN real de uma leitura, tratando add-ons EAN-5 e EAN-2
 * comuns em livros e revistas comerciais (códigos de 15 ou 18 dígitos)
 */
export function extractRealIsbn(raw: string): string {
  const clean = cleanCodeString(raw).replace(/[^0-9X]/gi, '').toUpperCase();

  // Caso 1: EAN-13 + EAN-5 (18 dígitos) ou EAN-13 + EAN-2 (15 dígitos) iniciando com 978 ou 979
  if ((clean.length === 18 || clean.length === 15) && (clean.startsWith('978') || clean.startsWith('979'))) {
    return clean.slice(0, 13);
  }

  // Caso 2: EAN-13 padrão
  if (clean.length === 13 && (clean.startsWith('978') || clean.startsWith('979'))) {
    return clean;
  }

  // Caso 3: ISBN-10
  if (clean.length === 10) {
    return clean;
  }

  // Fallback: retorna o que foi limpo ou o código alfanumérico original
  return clean || raw.trim();
}

/**
 * Configuração dos formatos esperados pelo ZXing
 */
const zxingHints = new Map<DecodeHintType, any>();
zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
]);
zxingHints.set(DecodeHintType.TRY_HARDER, true);

/**
 * Tenta decodificar usando API nativa BarcodeDetector do navegador (se suportada)
 */
async function decodeWithNativeBarcodeDetector(source: ImageBitmapSource): Promise<string | null> {
  if (typeof window === 'undefined' || !window.BarcodeDetector) return null;
  try {
    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
    });
    const results = await detector.detect(source);
    if (results && results.length > 0) {
      // Prioriza códigos que comecem com 978 ou 979
      const sorted = [...results].sort((a, b) => {
        const aIsbn = a.rawValue.startsWith('978') || a.rawValue.startsWith('979') || a.format === 'ean_13';
        const bIsbn = b.rawValue.startsWith('978') || b.rawValue.startsWith('979') || b.format === 'ean_13';
        if (aIsbn && !bIsbn) return -1;
        if (!aIsbn && bIsbn) return 1;
        return 0;
      });
      return sorted[0]?.rawValue ? extractRealIsbn(sorted[0].rawValue) : null;
    }
  } catch (e) {
    // Silencioso, continua para os próximos decodificadores
  }
  return null;
}

/**
 * Tenta decodificar dados de um Canvas usando ZXing com Hybrid e Global Binarizer
 */
function decodeCanvasWithZXing(canvas: HTMLCanvasElement): string | null {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const len = imageData.data.length;
    const luminanceData = new Uint8ClampedArray(len / 4);

    // Converte RGBA para Escala de Cinza Luminance
    for (let i = 0, j = 0; i < len; i += 4, j++) {
      luminanceData[j] = Math.round(
        imageData.data[i] * 0.299 + imageData.data[i + 1] * 0.587 + imageData.data[i + 2] * 0.114
      );
    }

    const luminanceSource = new RGBLuminanceSource(luminanceData, canvas.width, canvas.height);
    const reader = new MultiFormatReader();
    reader.setHints(zxingHints);

    // 1. Tenta com HybridBinarizer (ótimo para fundos variáveis)
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
      const res = reader.decode(bitmap);
      if (res && res.getText()) {
        return extractRealIsbn(res.getText());
      }
    } catch (e) {}

    // 2. Tenta com GlobalHistogramBinarizer (ótimo para contrastes clássicos de livros)
    try {
      const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource));
      const res = reader.decode(bitmap);
      if (res && res.getText()) {
        return extractRealIsbn(res.getText());
      }
    } catch (e) {}
  } catch (err) {
    // Silencioso
  }
  return null;
}

/**
 * Decodifica Canvas usando Quagga2
 */
async function decodeCanvasWithQuagga(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return new Promise((resolve) => {
      Quagga.decodeSingle(
        {
          src: dataUrl,
          numOfWorkers: 0, // modo síncrono no thread atual
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'code_128_reader',
              'upc_reader',
              'upc_e_reader',
              'code_39_reader',
            ],
            multiple: false,
          },
          locate: true,
          locator: {
            halfSample: true,
            patchSize: 'medium',
          },
        },
        (result) => {
          if (result && result.codeResult && result.codeResult.code) {
            resolve(extractRealIsbn(result.codeResult.code));
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (err) {
    return null;
  }
}

/**
 * Aplica realce de contraste (high-contrast binarization) em um canvas
 */
function enhanceCanvasContrast(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  // Calcula brilho médio
  let totalLuminance = 0;
  for (let i = 0; i < d.length; i += 4) {
    totalLuminance += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }
  const avgLuminance = totalLuminance / (d.length / 4);
  const threshold = Math.max(60, Math.min(190, avgLuminance));

  // Aplica contraste acentuado
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    // Estica o contraste
    const val = gray < threshold ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Recorta uma sub-região de um Canvas
 */
function cropCanvas(
  sourceCanvas: HTMLCanvasElement,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const sx = Math.floor(sourceCanvas.width * xPct);
  const sy = Math.floor(sourceCanvas.height * yPct);
  const sw = Math.floor(sourceCanvas.width * wPct);
  const sh = Math.floor(sourceCanvas.height * hPct);

  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  return canvas;
}

/**
 * Rotaciona um Canvas em 90 graus no sentido horário
 */
function rotateCanvas90(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.height;
  canvas.height = sourceCanvas.width;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  }
  return canvas;
}

/**
 * Carrega e redimensiona um File/Blob de imagem para resolução ideal (max 1400px)
 */
async function loadAndResizeImage(fileOrBlob: Blob | File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1400;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao obter contexto 2D'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };
    img.src = url;
  });
}

/**
 * Tenta todos os decodificadores em uma dada imagem canvas
 */
async function runDecodersOnCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  // 1. Tenta API Nativa (se disponível)
  try {
    const nativeRes = await decodeWithNativeBarcodeDetector(canvas);
    if (nativeRes) return nativeRes;
  } catch (e) {}

  // 2. Tenta ZXing (MultiFormat com Hybrid e Global)
  try {
    const zxingRes = decodeCanvasWithZXing(canvas);
    if (zxingRes) return zxingRes;
  } catch (e) {}

  // 3. Tenta Quagga2 (excelente para EAN-13 em fotos de livros)
  try {
    const quaggaRes = await decodeCanvasWithQuagga(canvas);
    if (quaggaRes) return quaggaRes;
  } catch (e) {}

  return null;
}

/**
 * Função MESTRA para decodificar código de barras de qualquer foto tirada no celular
 * Executa pipeline multi-resolução, cortes estratégicos e rotação automática.
 */
export async function decodeBarcodeFromImage(
  fileOrBlob: Blob | File,
  onProgress?: (step: string) => void
): Promise<string | null> {
  onProgress?.('Carregando foto com alta definição...');
  const baseCanvas = await loadAndResizeImage(fileOrBlob);

  // 1. Teste na imagem completa
  onProgress?.('Analisando código de barras...');
  let code = await runDecodersOnCanvas(baseCanvas);
  if (code) return code;

  // 2. Teste no corte central (onde o usuário costuma focar o código de barras)
  onProgress?.('Analisando área central da foto...');
  const centerCrop = cropCanvas(baseCanvas, 0.15, 0.25, 0.70, 0.50);
  code = await runDecodersOnCanvas(centerCrop);
  if (code) return code;

  // 3. Teste no terço inferior (contracapa clássica de livros com ISBN no rodapé)
  onProgress?.('Analisando rodapé da contracapa...');
  const bottomCrop = cropCanvas(baseCanvas, 0.10, 0.50, 0.80, 0.45);
  code = await runDecodersOnCanvas(bottomCrop);
  if (code) return code;

  // 4. Teste com rotação 90° (caso o celular tenha fotografado em orientação invertida)
  onProgress?.('Ajustando rotação da foto...');
  const rotatedCanvas = rotateCanvas90(baseCanvas);
  code = await runDecodersOnCanvas(rotatedCanvas);
  if (code) return code;

  // 5. Teste no corte central rotacionado
  const rotatedCenter = cropCanvas(rotatedCanvas, 0.15, 0.25, 0.70, 0.50);
  code = await runDecodersOnCanvas(rotatedCenter);
  if (code) return code;

  // 6. Teste com realce de contraste para livros com papel escuro, verniz ou sombra
  onProgress?.('Aumentando contraste e iluminação...');
  const enhancedCanvas = enhanceCanvasContrast(baseCanvas);
  code = await runDecodersOnCanvas(enhancedCanvas);
  if (code) return code;

  const enhancedCenter = enhanceCanvasContrast(centerCrop);
  code = await runDecodersOnCanvas(enhancedCenter);
  if (code) return code;

  return null;
}

/**
 * Decodifica um frame de vídeo em tempo real (para uso na Câmera ao Vivo)
 */
export async function decodeVideoFrame(
  videoElement: HTMLVideoElement,
  workCanvas: HTMLCanvasElement
): Promise<string | null> {
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  if (!vw || !vh || videoElement.readyState < 2) return null;

  // 1. Tenta API Nativa direto no elemento <video> (zero-copy GPU acelerado)
  if (typeof window !== 'undefined' && window.BarcodeDetector) {
    try {
      const nativeCode = await decodeWithNativeBarcodeDetector(videoElement);
      if (nativeCode) return nativeCode;
    } catch (e) {}
  }

  // 2. Se nativo não disponível, desenha no canvas e executa ZXing
  workCanvas.width = Math.min(vw, 800);
  workCanvas.height = Math.round((vh * workCanvas.width) / vw);
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0, workCanvas.width, workCanvas.height);

  // Tenta ZXing no canvas reduzido (rápido para manter 20-30 FPS)
  return decodeCanvasWithZXing(workCanvas);
}
