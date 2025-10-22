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

  const processAndGroupRows = (rows: any[][]): Book[] => {
    const bookGroups = new Map<string, Book>();

    rows.forEach((row) => {
      if (!row || row.every(cell => cell === null || String(cell).trim() === '')) {
        return; // Skip empty rows
      }

      const [code, title, author, category, publisher, bookType, isbn] = row.map(String);

      if (!code || code.trim() === '') {
        return; // Skip rows without a code
      }
      
      const upperCode = code.toUpperCase();

      if (bookGroups.has(upperCode)) {
        const existingBook = bookGroups.get(upperCode)!;
        existingBook.quantity += 1;
      } else {
        bookGroups.set(upperCode, {
          id: generateId(),
          code: upperCode,
          title: title.toUpperCase(),
          author: author.toUpperCase(),
          category: category.toUpperCase() || 'GERAL',
          publisher: publisher.toUpperCase(),
          bookType: bookType.toUpperCase(),
          isbn: isbn || '',
          shelf: 'N/A',
          quantity: 1,
        });
      }
    });

    return Array.from(bookGroups.values());
  };

  const handleImport = () => {
    if (!file) {
      showError('Por favor, selecione um arquivo para importar.');
      return;
    }
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let groupedBooks: Book[] = [];
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
          const content = event.target?.result as string;
          const rows = content.split(/\r?\n/).map(line => line.split(line.includes(';') ? ';' : '\t'));
          groupedBooks = processAndGroupRows(rows);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          groupedBooks = processAndGroupRows(rows.slice(1)); // slice(1) to skip header
        } else {
          showError('Formato de arquivo não suportado. Use .txt, .csv, .xlsx ou .xls.');
          setIsProcessing(false);
          return;
        }
        
        if (groupedBooks.length > 0) {
          const result = onImport(groupedBooks);
          setProcessedCount(result.processedCount);
          setUniqueBookCount(result.uniqueBookCount);
        }
        setHasResult(true);
      } catch (error) {
        showError('Ocorreu um erro crítico ao processar o arquivo.');
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <DialogContent className="sm:max-w-[625px]">
      <DialogHeader>
        <DialogTitle>Importar Livros</DialogTitle>
        <DialogDescription>
          Selecione um arquivo para cadastrar os livros. O sistema agrupará por código e somará as quantidades.
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
                <li>A ordem das colunas deve ser: <br />
                  <code className="font-mono bg-muted p-1 rounded text-xs">Código;Título;Autor;Categoria;Editora;Tipo;ISBN;...</code>
                </li>
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
              Foram processados <strong>{uniqueBookCount}</strong> tipos de livros únicos, totalizando <strong>{processedCount}</strong> cópias.
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