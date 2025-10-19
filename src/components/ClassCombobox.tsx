"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react"
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

interface ClassComboboxProps {
  classes: string[];
  value: string;
  onChange: (value: string) => void;
  onAddClass: (value: string) => void;
  onDeleteClass: (value: string) => void;
}

export function ClassCombobox({ classes, value, onChange, onAddClass, onDeleteClass }: ClassComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleCreate = () => {
    if (inputValue && !classes.includes(inputValue.toUpperCase())) {
      onAddClass(inputValue.toUpperCase());
      onChange(inputValue.toUpperCase());
      setInputValue("");
      setOpen(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, className: string) => {
    e.stopPropagation(); // Prevent the item from being selected when deleting
    onDeleteClass(className);
  };

  const showCreateOption = inputValue && !classes.some(c => c.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || "Selecione ou crie uma turma..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar ou criar turma..." 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? ' ' : 'Nenhuma turma encontrada.'}
            </CommandEmpty>
            <CommandGroup>
              {showCreateOption && (
                <CommandItem
                  onSelect={handleCreate}
                  className="cursor-pointer"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar turma: "{inputValue}"
                </CommandItem>
              )}
              {classes.map((className) => (
                <CommandItem
                  key={className}
                  value={className}
                  onSelect={() => {
                    onChange(className)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === className ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{className}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDelete(e, className)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}