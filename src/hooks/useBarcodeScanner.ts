import { useEffect, useRef } from 'react';

export interface BarcodeScanEvent {
  code: string;
  durationMs: number;
  averageKeyIntervalMs: number;
  isScannerSpeed: boolean;
}

interface UseBarcodeScannerOptions {
  enabled?: boolean;
  onScan: (code: string, eventDetails: BarcodeScanEvent) => void;
  minLength?: number;
  maxIntervalMs?: number; // Intervalo máximo entre teclas para considerar scanner (padrão 60ms)
  preventDefault?: boolean;
}

/**
 * Hook para escuta global e detecção inteligente de leitor de código de barras USB/Bluetooth.
 */
export function useBarcodeScanner({
  enabled = true,
  onScan,
  minLength = 3,
  maxIntervalMs = 65,
  preventDefault = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const timestampsRef = useRef<number[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();

      // Ignora teclas modificadoras
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) {
        return;
      }

      // Se for tecla Enter ou Tab, pode ser o fim da leitura do scanner
      if (event.key === 'Enter' || event.key === 'Tab') {
        const code = bufferRef.current.trim();
        const timestamps = timestampsRef.current;

        if (code.length >= minLength && timestamps.length >= minLength) {
          // Calcula a média de tempo entre cada tecla
          let totalDiff = 0;
          for (let i = 1; i < timestamps.length; i++) {
            totalDiff += timestamps[i] - timestamps[i - 1];
          }
          const avgInterval = totalDiff / (timestamps.length - 1);
          const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];

          // Leitores USB enviam teclas com intervalo inferior a ~50ms
          const isScannerSpeed = avgInterval <= maxIntervalMs;

          if (isScannerSpeed || code.length >= 8) {
            if (preventDefault) {
              event.preventDefault();
              event.stopPropagation();
            }

            onScan(code, {
              code,
              durationMs: totalDuration,
              averageKeyIntervalMs: Math.round(avgInterval),
              isScannerSpeed,
            });
          }
        }

        // Limpa buffer
        bufferRef.current = '';
        timestampsRef.current = [];
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Adiciona apenas caracteres imprimíveis
      if (event.key.length === 1) {
        // Se o tempo desde o último caractere for muito longo, reinicia o buffer
        if (timestampsRef.current.length > 0) {
          const lastTime = timestampsRef.current[timestampsRef.current.length - 1];
          if (now - lastTime > maxIntervalMs * 2.5) {
            // Provavelmente digitação humana manual pausada, reseta o buffer
            bufferRef.current = '';
            timestampsRef.current = [];
          }
        }

        bufferRef.current += event.key;
        timestampsRef.current.push(now);

        // Limpa timeout anterior e agenda reset de segurança se não houver Enter
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
          timestampsRef.current = [];
        }, maxIntervalMs * 3);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, onScan, minLength, maxIntervalMs, preventDefault]);
}
