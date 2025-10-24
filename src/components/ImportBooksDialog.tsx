import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Book } from '@/lib/types';
import { showError } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FileText } from 'lucide-react';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface ImportBooksDialogProps {
  onImport: (newBooks: Book[]) => { processedCount: number, uniqueBookCount: number };
  closeDialog: () => void;
}

const processRows = (rows: any[][]): Book[] => {
  const newBooks: Book[] = [];
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    // Skip header row (index 0) and empty rows
    if (index === 0 || !row || row.every(cell => cell === null || String(cell).trim() === '')) {
      return; 
    }

    // Expected columns: Código;Título;Autor;Categoria;Editora;Tipo;ISBN;Quantidade
    const [code, title, author, category, publisher, bookType, isbn, quantityStr] = row.map(cell => String(cell || '').trim());

    if (!code) {
      console.warn(`Skipping row ${index + 1}: Code is missing.`);
      return;
    }
    
    const upperCode = code.toUpperCase();

    if (seenCodes.has(upperCode)) {
        showError(`Código duplicado no arquivo: ${upperCode}. Apenas a 1ª ocorrência foi importada.`);
        console.warn(`Skipping duplicate code in row ${index + 1}: ${upperCode}`);
        return;
    }
    seenCodes.add(upperCode);

    const quantity = parseInt(quantityStr, 10);

    newBooks.push({
      id: generateId(),
      code: upperCode,
      title: title.toUpperCase(),
      author: author.toUpperCase(),
      category: category.toUpperCase() || 'GERAL',
      publisher: publisher.toUpperCase(),
      bookType: bookType.toUpperCase(),
      isbn: isbn || '',
      shelf: 'N/A',
      quantity: !isNaN(quantity) && quantity > 0 ? quantity : 1,
    });
  });

  return newBooks;
};


const ImportBooksDialog = ({ onImport, closeDialog }: ImportBooksDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [uniqueBookCount, setUniqueBookCount] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
    resetState(true);
  };

  const resetState = (keepFile = false) => {
    if (!keepFile) {
      setFile(null);
      const fileInput = document.getElementById('book-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
    setIsProcessing(false);
    setHasResult(false);
    setProcessedCount(0);
    setUniqueBookCount(0);
  };

  const handleImport = () => {
    if (!file) {
      showError('Por favor, selecione um arquivo para importar.');
      return;
    }
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onerror = () => {
      showError('Ocorreu um erro ao ler o arquivo.');
      console.error('FileReader error:', reader.error);
      setIsProcessing(false);
    };

    reader.onload = (event) => {
      // Use a timeout to avoid blocking the UI thread, allowing the "Processing..." state to render.
      setTimeout(() => {
        try {
          let booksToImport: Book[] = [];
          const fileName = file.name.toLowerCase();
          const fileResult = event.target?.result;

          if (!fileResult) {
            showError('O arquivo está vazio ou não pôde ser lido.');
            setIsProcessing(false);
            return;
          }

          if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
            const content = fileResult as string;
            // Try to detect delimiter: comma, semicolon, or tab
            const delimiter = content.includes(';') ? ';' : (content.includes(',') ? ',' : '\t');
            const rows = content.split(/\r?\n/).map(line => line.split(delimiter));
            booksToImport = processRows(rows);
          } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const data = new Uint8Array(fileResult as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // Use { header: 1 } to get an array of arrays (rows), including the header
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            booksToImport = processRows(rows);
          } else {
            showError('Formato de arquivo não suportado. Use .txt, .csv, .xlsx ou .xls.');
            setIsProcessing(false);
            return;
          }
          
          if (booksToImport.length > 0) {
            const result = onImport(booksToImport);
            setProcessedCount(result.processedCount);
            setUniqueBookCount(result.uniqueBookCount);
          } else {
            showError('Nenhum livro válido encontrado no arquivo.');
          }
          setHasResult(true);
        } catch (error) {
          showError('Ocorreu um erro crítico ao processar o arquivo. Verifique o formato das colunas.');
          console.error('Critical import error:', error);
        } finally {
          setIsProcessing(false);
        }
      }, 50);
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      // For Excel files, read as ArrayBuffer
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <DialogContent className="sm:max-w-[625px]">
      <DialogHeader>
        <DialogTitle>Importar Livros</DialogTitle>
        <DialogDescription>
          Selecione um arquivo para cadastrar os livros. <strong>Atenção:</strong> Esta ação substituirá todos os livros existentes no sistema.
        </DialogDescription>
      </DialogHeader>
      
      {!hasResult ? (
        <div className="py-4 space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Instruções de Formato</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>O arquivo pode ser <strong>.txt, .csv, .xlsx ou .xls</strong>.</li>
                <li>A primeira linha (cabeçalho) será ignorada.</li>
                <li>A ordem das colunas deve ser: <br />
                  <code className="font-mono bg-muted p-1 rounded text-xs">Código;Título;Autor;Categoria;Editora;Tipo;ISBN;Quantidade</code>
                </li>
                 <li>A coluna <strong>Quantidade</strong> é opcional. Se não for informada, o valor será 1.</li>
              </ul>
            </AlertDescription>
          </Alert>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="book-file">Arquivo</Label>
            <Input id="book-file" type="file" accept=".txt,.csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold">Resultado da Importação</h3>
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Importação Concluída</AlertTitle>
            <AlertDescription>
              Foram processados <strong>{uniqueBookCount}</strong> tipos de livros, totalizando <strong>{processedCount}</strong> cópias.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <DialogFooter>
        {hasResult ? (
          <>
            <Button type="button" variant="secondary" onClick={() => resetState()}>Importar Outro</Button>
            <DialogClose asChild>
              <Button type="button">Fechar</Button>
            </DialogClose>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleImport} disabled={!file || isProcessing}>
              {isProcessing ? 'Processando...' : 'Importar'}
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default ImportBooksDialog;