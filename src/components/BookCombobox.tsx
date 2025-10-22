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
import { useLocalStorage } from "@/hooks/useLocalStorage"

interface BookComboboxProps {
  books: Book[];
  value: string;
  onChange: (value: string) => void;
}

export function BookCombobox({ books, value, onChange }: BookComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [loans] = useLocalStorage<Loan[]>('loans', []);

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
    return book ? book.title : "Selecione um livro disponível...";
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar por título ou autor..." />
          <CommandList>
            <CommandEmpty>Nenhum livro disponível encontrado.</CommandEmpty>
            <CommandGroup>
              {availableBooks.map((book) => (
                <CommandItem
                  key={book.id}
                  value={`${book.title} ${book.author}`}
                  onSelect={() => {
                    onChange(book.code)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === book.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <p>{book.title}</p>
                    <p className="text-xs text-muted-foreground">Autor: {book.author}</p>
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
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