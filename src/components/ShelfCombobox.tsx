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

interface ShelfComboboxProps {
  shelves: string[];
  value: string;
  onChange: (value: string) => void;
}

export function ShelfCombobox({ shelves, value, onChange }: ShelfComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const filteredShelves = React.useMemo(() => {
    const lowerCaseInput = inputValue.toLowerCase();
    return shelves.filter(shelf => shelf.toLowerCase().includes(lowerCaseInput));
  }, [shelves, inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || "Selecione uma prateleira..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar prateleira..." 
            value={inputValue}
            onValueChange={setInputValue}
            className="uppercase placeholder:normal-case"
          />
          <CommandList>
            <CommandEmpty>Nenhuma prateleira encontrada.</CommandEmpty>
            <CommandGroup>
              {filteredShelves.map((shelfName) => (
                <CommandItem
                  key={shelfName}
                  value={shelfName}
                  onSelect={() => {
                    onChange(shelfName)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === shelfName ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{shelfName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}