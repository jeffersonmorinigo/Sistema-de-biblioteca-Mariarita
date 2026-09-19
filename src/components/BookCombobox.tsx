"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { normalizeString } from "@/utils/stringUtils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Book, Loan } from "@/lib/types"
import { useFirestore } from "@/hooks/useFirestore"

interface BookComboboxProps {
  books?: Book[];
  value: string;
  onChange: (value: string) => void;
}

export function BookCombobox({ books = [], value, onChange }: BookComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const { data: loans } = useFirestore<Loan>('loans');

  const activeLoansByCode = useMemo(() => {
    const counts = new Map<string, number>();
    (loans || []).forEach(loan => {
      if (loan && !loan.returnDate && loan.bookCode) {
        counts.set(loan.bookCode, (counts.get(loan.bookCode) || 0) + 1);
      }
    });
    return counts;
  }, [loans]);

  const availableBooks = useMemo(() => {
    return (books || [])
      .filter(book => Boolean(book && book.code))
      .map(book => {
        const loanedCount = book.code ? (activeLoansByCode.get(book.code) || 0) : 0;
        const totalQty = typeof book.quantity === 'number' ? book.quantity : (parseInt(String(book.quantity || 1), 10) || 1);
        const availableCount = totalQty - loanedCount;
        return { ...book, availableCount };
      })
      .filter(book => book.availableCount > 0)
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' }));
  }, [books, activeLoansByCode]);

  const selectedBookTitle = useMemo(() => {
    if (!value) return "Selecione um livro disponível...";
    const book = (books || []).find(b => b && b.code === value);
    if (!book) return "Selecione um livro disponível...";
    return `${book.title || 'Sem título'} (Cód: ${book.code} | Prat: ${book.shelf || 'N/A'})`;
  }, [value, books]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedBookTitle}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width,320px)] max-w-[90vw] p-0"
        side="bottom"
        align="start"
      >
        <Command filter={(val, search) => {
          if (!search) return 1;
          if (normalizeString(val).includes(normalizeString(search))) return 1;
          return 0;
        }}>
          <CommandInput placeholder="Buscar por Título, Autor, Código, Prateleira..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Nenhum livro disponível encontrado.</CommandEmpty>
            <CommandGroup>
              {availableBooks.map((book) => (
                <CommandItem
                  key={book.id || book.code}
                  value={`${book.title || ''} ${book.author || ''} ${book.shelf || ''} ${book.code || ''} ${book.isbn || ''} ${book.category || ''} ${book.bookType || ''}`}
                  onSelect={() => {
                    onChange(book.code)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between space-x-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === book.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title || 'Sem título'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {book.code}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {book.author || 'Autor desc.'} | Prat: {book.shelf || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 ml-2 flex-shrink-0 font-semibold">
                    {book.availableCount} {book.availableCount === 1 ? 'disp.' : 'disps.'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}