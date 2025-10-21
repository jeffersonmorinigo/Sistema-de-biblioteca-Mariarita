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
import { FileText, Download } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface ImportBooksDialogProps {
  onImport: (newBooks: Omit<Book, 'id' | 'status'>[]) => { processedCount: number };
  closeDialog: () => void;
}

interface ImportError {
  line: number;
  message: string;
  data: string;
}

const ImportBooksDialog = ({ onImport, closeDialog }: ImportBooksDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

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
      if (fileInput) {
        fileInput.value = '';
      }
    }
    setImportErrors([]);
    setIsProcessing(false);
    setHasResult(false);
    setProcessedCount(0);
  };

  const processRows = (rows: any[][]): { newBooks: Omit<Book, 'id' | 'status'>[], errors: ImportError[] } => {
    const newBooks: Omit<Book, 'id' | 'status'>[] = [];
    const errors: ImportError[] = [];

    rows.forEach((row, index) => {
      const lineNumber = index + 2; // Assuming line 1 is header
      if (!row || row.every(cell => cell === null || String(cell).trim() === '')) {
        return; // Skip empty rows
      }

      // Each row in the file is treated as a single book (quantity = 1)
      const [code, title, author, category, publisher, _ignoredType, isbn] = row.map(String);

      if (!code || code.trim() === '') {
        errors.push({ line: lineNumber, message: "A coluna 'Código' não pode estar vazia.", data: row.join('; ') });
        return;
      }

      newBooks.push({
        code: code.toUpperCase(),
        title: title.toUpperCase(),
        author: author.toUpperCase(),
        category: category.toUpperCase() || 'GERAL',
        publisher: publisher.toUpperCase(),
        isbn: isbn || '',
        shelf: 'N/A',
      });
    });

    return { newBooks, errors };
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
        let processedData;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
          const content = event.target?.result as string;
          const lines = content.split(/\r?\n/);
          const rows = lines.map(line => line.split(line.includes(';') ? ';' : '\t'));
          processedData = processRows(rows);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          processedData = processRows(rows.slice(1));
        } else {
          showError('Formato de arquivo não suportado. Use .txt, .csv, .xlsx ou .xls.');
          setIsProcessing(false);
          return;
        }
        
        const { newBooks, errors } = processedData;
        setImportErrors(errors);

        if (newBooks.length > 0) {
          const result = onImport(newBooks);
          setProcessedCount(result.processedCount);
        } else {
          setProcessedCount(0);
        }
        setHasResult(true);
      } catch (error) {
        showError('Ocorreu um erro crítico ao processar o arquivo. Verifique seu formato e conteúdo.');
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    }
  };

  const downloadErrorReport = () => {
    const reportContent = importErrors.map(e => `Linha ${e.line}: ${e.message}\nDados: ${e.data}`).join('\n\n');
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio_erros_importacao.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DialogContent className="sm:max-w-[625px]">
      <DialogHeader>
        <DialogTitle>Importar Livros</DialogTitle>
        <DialogDescription>
          Selecione um arquivo para cadastrar todos os livros de uma vez. Cada linha será um novo livro.
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
                <li>A <strong>coluna de Quantidade será ignorada</strong>, pois cada linha será um livro.</li>
                <li>A ordem das colunas deve ser: <br />
                  <code className="font-mono bg-muted p-1 rounded text-xs">Código;Título;Autor;Categoria;Editora;Tipo;ISBN;...</code>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="book-file">Arquivo (.txt, .csv, .xlsx)</Label>
            <Input id="book-file" type="file" accept=".txt,.csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <h3 className="text-lg font-semibold">Resultado da Importação</h3>
          <Alert variant={importErrors.length > 0 ? "destructive" : "default"}>
            <FileText className="h-4 w-4" />
            <AlertTitle>Importação Concluída</AlertTitle>
            <AlertDescription>
              <strong>{processedCount}</strong> livros foram cadastrados com sucesso.
              {importErrors.length > 0 && ` ${importErrors.length} linhas continham erros e foram ignoradas.`}
            </AlertDescription>
          </Alert>
          
          {importErrors.length > 0 && (
            <div className="pt-4">
              <h4 className="font-semibold mb-2">Detalhes dos Erros:</h4>
              <ScrollArea className="h-40 w-full rounded-md border p-4">
                {importErrors.map((error, index) => (
                  <div key={index} className="text-xs mb-2 pb-2 border-b last:border-b-0">
                    <p className="font-bold">Linha {error.line}: <span className="font-normal text-red-600">{error.message}</span></p>
                    <p className="text-muted-foreground truncate">Dados: {error.data}</p>
                  </div>
                ))}
              </ScrollArea>
              <Button onClick={downloadErrorReport} variant="outline" size="sm" className="mt-2">
                <Download className="mr-2 h-4 w-4" />
                Baixar Relatório de Erros
              </Button>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        {hasResult ? (
          <>
            <Button type="button" variant="secondary" onClick={() => resetState()}>Importar Outro Arquivo</Button>
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