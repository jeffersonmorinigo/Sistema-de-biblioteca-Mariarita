"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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
  value: string;
  onChange: (value: string) => void;
}

export function BookCombobox({ books, value, onChange }: BookComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? books.find((book) => book.id === value)?.title
            : "Selecione ou busque um livro..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar por título ou autor..." />
          <CommandList>
            <CommandEmpty>Nenhum livro encontrado.</CommandEmpty>
            <CommandGroup>
              {books.map((book) => (
                <CommandItem
                  key={book.id}
                  value={`${book.title} ${book.author}`}
                  onSelect={() => {
                    onChange(book.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === book.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div>
                    <p>{book.title}</p>
                    <p className="text-xs text-muted-foreground">Autor: {book.author}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}