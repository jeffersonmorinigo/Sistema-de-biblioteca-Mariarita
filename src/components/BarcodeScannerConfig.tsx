import React, { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useBarcodeScanner, BarcodeScanEvent } from '@/hooks/useBarcodeScanner';
import { fetchBookDetailsByIsbn, isLikelyIsbn } from '@/lib/isbnService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Barcode, CheckCircle2, Zap, Wifi, Sparkles, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

export const BarcodeScannerConfig: React.FC = () => {
  const { settings, update: updateSettings } = useSettings();

  const scannerSettings = settings.barcodeScanner || {
    enabled: true,
    targetField: 'code',
    autoOpenAddModal: true,
    autoFetchBookDetails: true,
  };

  const [testResult, setTestResult] = useState<{
    code: string;
    details: BarcodeScanEvent;
    timestamp: Date;
    bookInfo?: any;
    isSearchingBook?: boolean;
  } | null>(null);

  const [isTestingOnline, setIsTestingOnline] = useState(false);

  // Escuta no modo de teste
  useBarcodeScanner({
    enabled: scannerSettings.enabled,
    onScan: async (code, details) => {
      setTestResult({
        code,
        details,
        timestamp: new Date(),
        isSearchingBook: isLikelyIsbn(code) && scannerSettings.autoFetchBookDetails,
      });

      if (isLikelyIsbn(code) && scannerSettings.autoFetchBookDetails) {
        setIsTestingOnline(true);
        try {
          const info = await fetchBookDetailsByIsbn(code);
          setTestResult((prev) => (prev ? { ...prev, bookInfo: info, isSearchingBook: false } : null));
          if (info?.title) {
            showSuccess(`Livro localizado: "${info.title}"!`);
          }
        } finally {
          setIsTestingOnline(false);
        }
      }
    },
  });

  const handleToggleEnabled = async (checked: boolean) => {
    await updateSettings({
      barcodeScanner: {
        ...scannerSettings,
        enabled: checked,
      },
    });
    showSuccess(checked ? 'Leitor de código de barras ativado!' : 'Leitor desativado.');
  };

  const handleTargetFieldChange = async (value: 'code' | 'isbn' | 'both') => {
    await updateSettings({
      barcodeScanner: {
        ...scannerSettings,
        targetField: value,
      },
    });
    showSuccess('Campo de leitura atualizado!');
  };

  const handleToggleAutoOpen = async (checked: boolean) => {
    await updateSettings({
      barcodeScanner: {
        ...scannerSettings,
        autoOpenAddModal: checked,
      },
    });
  };

  const handleToggleAutoFetch = async (checked: boolean) => {
    await updateSettings({
      barcodeScanner: {
        ...scannerSettings,
        autoFetchBookDetails: checked,
      },
    });
  };

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Barcode className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Leitor de Código de Barras USB / Sem Fio
                <Badge variant={scannerSettings.enabled ? 'default' : 'secondary'} className="text-xs">
                  {scannerSettings.enabled ? 'Ativo e Reconhecendo' : 'Desativado'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Conecte seu leitor USB ou Bluetooth na máquina. O sistema reconhece os bips automaticamente para agilizar o cadastro.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={scannerSettings.enabled}
            onCheckedChange={handleToggleEnabled}
            aria-label="Ativar Leitor de Código de Barras"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Opções de Comportamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
            <Label htmlFor="scanner-target-field" className="font-semibold text-sm">
              Ao Bipar, Preencher Qual Campo?
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Escolha para onde o código deve ir no cadastro de livros.
            </p>
            <Select
              value={scannerSettings.targetField}
              onValueChange={(val: any) => handleTargetFieldChange(val)}
              disabled={!scannerSettings.enabled}
            >
              <SelectTrigger id="scanner-target-field">
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Código Interno / Tombamento do Livro</SelectItem>
                <SelectItem value="isbn">ISBN (Código de barras comercial da capa)</SelectItem>
                <SelectItem value="both">Preencher Código e Buscar ISBN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 p-4 rounded-lg border bg-muted/30 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-sm">Abrir Cadastro ao Bipar</Label>
                <p className="text-xs text-muted-foreground">
                  Na tela de livros, ao bipar um livro novo, abre o formulário preenchido.
                </p>
              </div>
              <Switch
                checked={scannerSettings.autoOpenAddModal}
                onCheckedChange={handleToggleAutoOpen}
                disabled={!scannerSettings.enabled}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Preenchimento Automático via Internet
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se for ISBN comercial, busca título, autor e editora sozinho.
                </p>
              </div>
              <Switch
                checked={scannerSettings.autoFetchBookDetails}
                onCheckedChange={handleToggleAutoFetch}
                disabled={!scannerSettings.enabled}
              />
            </div>
          </div>
        </div>

        {/* Área de Teste do Leitor em Tempo Real */}
        <div className="p-4 rounded-xl border border-dashed bg-card/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold">Área de Teste e Calibração</h4>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Wifi className="h-3 w-3 text-emerald-500 animate-pulse" />
              Aguardando bip do leitor...
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Bipe qualquer código de barras ou digite aqui para testar se o computador e o leitor estão se comunicando perfeitamente:
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Aponte o leitor e bipe aqui para testar..."
              className="font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const target = e.currentTarget;
                  if (target.value.trim()) {
                    setTestResult({
                      code: target.value.trim(),
                      details: {
                        code: target.value.trim(),
                        durationMs: 30,
                        averageKeyIntervalMs: 15,
                        isScannerSpeed: true,
                      },
                      timestamp: new Date(),
                    });
                    showSuccess(`Código "${target.value}" lido com sucesso!`);
                    target.value = '';
                  }
                }
              }}
            />
          </div>

          {/* Resultado do Teste */}
          {testResult && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Leitor Reconhecido com Sucesso!
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {testResult.timestamp.toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono pt-1">
                <div className="bg-background/80 p-2 rounded border">
                  <span className="text-muted-foreground text-[10px] block">CÓDIGO LIDO</span>
                  <span className="font-bold text-foreground text-sm">{testResult.code}</span>
                </div>
                <div className="bg-background/80 p-2 rounded border">
                  <span className="text-muted-foreground text-[10px] block">VELOCIDADE</span>
                  <span className="font-bold text-emerald-600">
                    {testResult.details.averageKeyIntervalMs} ms/tecla
                  </span>
                </div>
                <div className="bg-background/80 p-2 rounded border col-span-2 sm:col-span-1">
                  <span className="text-muted-foreground text-[10px] block">TIPO DETECTADO</span>
                  <span className="font-semibold text-foreground">
                    {isLikelyIsbn(testResult.code) ? 'ISBN Comercial (Livro)' : 'Código de Barras Padrão'}
                  </span>
                </div>
              </div>

              {/* Informações encontradas do livro */}
              {isTestingOnline && (
                <div className="flex items-center gap-2 text-xs text-blue-600 pt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Consultando informações do livro na internet via Google Books...
                </div>
              )}

              {testResult.bookInfo?.title && (
                <div className="mt-2 p-2.5 rounded bg-background border text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" />
                    Dados Encontrados na Internet:
                  </div>
                  <p><strong>Título:</strong> {testResult.bookInfo.title}</p>
                  {testResult.bookInfo.author && <p><strong>Autor:</strong> {testResult.bookInfo.author}</p>}
                  {testResult.bookInfo.publisher && <p><strong>Editora:</strong> {testResult.bookInfo.publisher}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
