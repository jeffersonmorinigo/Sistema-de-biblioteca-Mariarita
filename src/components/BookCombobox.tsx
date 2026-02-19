"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  books: Book[];
  value: string;
  onChange: (value: string) => void;
}

export function BookCombobox({ books, value, onChange }: BookComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const { data: loans } = useFirestore<Loan>('loans');

  const activeLoansByCode = useMemo(() => {
    const counts = new Map<string, number>();
    loans.forEach(loan => {
      if (!loan.returnDate) {
        counts.set(loan.bookCode, (counts.get(loan.bookCode) || 0) + 1);
      }
    });
    return counts;
  }, [loans]);

  const availableBooks = useMemo(() => {
    return books
      .map(book => {
        const loanedCount = activeLoansByCode.get(book.code) || 0;
        const availableCount = book.quantity - loanedCount;
        return { ...book, availableCount };
      })
      .filter(book => book.availableCount > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [books, activeLoansByCode]);

  const selectedBookTitle = useMemo(() => {
    if (!value) return "Selecione um livro disponível...";
    const book = books.find(b => b.code === value);
    return book ? `${book.title} (Cód: ${book.code} | Prat: ${book.shelf || 'N/A'})` : "Selecione um livro disponível...";
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
        className="w-[--radix-popover-trigger-width] p-0"
        side="bottom"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar por Título, Autor, Código, Prateleira..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Nenhum livro disponível encontrado.</CommandEmpty>
            <CommandGroup>
              {availableBooks.map((book) => (
                <CommandItem
                  key={book.id}
                  value={`${book.title} ${book.author} ${book.shelf} ${book.code} ${book.isbn} ${book.category} ${book.bookType}`}
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
                    <p className="font-medium truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {book.author} | Cód: {book.code} | Prat: {book.shelf || 'N/A'}
                    </p>
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