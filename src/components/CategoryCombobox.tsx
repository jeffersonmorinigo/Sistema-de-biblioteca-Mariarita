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

interface CategoryComboboxProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  onAddCategory?: (value: string) => void;
  onDeleteCategory?: (value: string) => void;
}

export function CategoryCombobox({ categories, value, onChange, onAddCategory, onDeleteCategory }: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleCreate = () => {
    const formattedValue = inputValue.toUpperCase();
    if (formattedValue && !categories.includes(formattedValue) && onAddCategory) {
      onAddCategory(formattedValue);
      onChange(formattedValue);
      setInputValue("");
      setOpen(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, categoryName: string) => {
    e.stopPropagation();
    if (onDeleteCategory) {
      onDeleteCategory(categoryName);
    }
  };

  const showCreateOption = onAddCategory && inputValue && !categories.some(c => c.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || "Selecione uma categoria..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={onAddCategory ? "Buscar ou criar categoria..." : "Buscar categoria..."}
            value={inputValue}
            onValueChange={setInputValue}
            className="uppercase placeholder:normal-case"
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? ' ' : 'Nenhuma categoria encontrada.'}
            </CommandEmpty>
            <CommandGroup>
              {showCreateOption && (
                <CommandItem
                  onSelect={handleCreate}
                  className="cursor-pointer"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar categoria: "{inputValue.toUpperCase()}"
                </CommandItem>
              )}
              {categories.map((categoryName) => (
                <CommandItem
                  key={categoryName}
                  value={categoryName}
                  onSelect={() => {
                    onChange(categoryName)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === categoryName ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{categoryName}</span>
                  {onDeleteCategory && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDelete(e, categoryName)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}