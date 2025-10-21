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
import { Book } from "@/lib/types"

interface BookComboboxProps {
  books: Book[];
  value: string; // Now expects a book code
  onChange: (value: string) => void; // Returns a book code
}

export function BookCombobox({ books, value, onChange }: BookComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const bookGroups = useMemo(() => {
    const groups = new Map<string, { title: string; author: string; available: number }>();
    books.forEach(book => {
      if (!groups.has(book.code)) {
        groups.set(book.code, { title: book.title, author: book.author, available: 0 });
      }
      if (book.status === 'available') {
        groups.get(book.code)!.available++;
      }
    });
    return Array.from(groups.entries())
      .map(([code, data]) => ({ code, ...data }))
      .filter(group => group.available > 0) // Only show books with available copies
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [books]);

  const selectedBookTitle = useMemo(() => {
    if (!value) return "Selecione um livro disponível...";
    const group = bookGroups.find(bg => bg.code === value);
    return group ? group.title : "Selecione um livro disponível...";
  }, [value, bookGroups]);

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
              {bookGroups.map((group) => (
                <CommandItem
                  key={group.code}
                  value={`${group.title} ${group.author}`}
                  onSelect={() => {
                    onChange(group.code)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === group.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <p>{group.title}</p>
                    <p className="text-xs text-muted-foreground">Autor: {group.author}</p>
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                    {group.available} {group.available === 1 ? 'disp.' : 'disps.'}
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