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

interface BookTypeComboboxProps {
  types: string[];
  value: string;
  onChange: (value: string) => void;
}

export function BookTypeCombobox({ types, value, onChange }: BookTypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const filteredTypes = React.useMemo(() => {
    const lowerCaseInput = inputValue.toLowerCase();
    return types.filter(type => type.toLowerCase().includes(lowerCaseInput));
  }, [types, inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || "Selecione um tipo..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar tipo..." 
            value={inputValue}
            onValueChange={setInputValue}
            className="uppercase placeholder:normal-case"
          />
          <CommandList>
            <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
            <CommandGroup>
              {filteredTypes.map((typeName) => (
                <CommandItem
                  key={typeName}
                  value={typeName}
                  onSelect={() => {
                    onChange(typeName)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === typeName ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{typeName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}