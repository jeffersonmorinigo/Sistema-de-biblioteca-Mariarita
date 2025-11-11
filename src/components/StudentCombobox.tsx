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
import { Student } from "@/lib/types"

interface StudentComboboxProps {
  students: Student[];
  value: string;
  onChange: (value: string) => void;
}

export function StudentCombobox({ students, value, onChange }: StudentComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedStudentDisplay = React.useMemo(() => {
    if (!value) return "Selecione ou busque um aluno...";
    const student = students.find((s) => s.id === value);
    return student ? `${student.name} - Turma: ${student.class}` : "Selecione ou busque um aluno...";
  }, [value, students]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedStudentDisplay}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar por nome ou turma..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
            <CommandGroup>
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  // Melhorando o valor de busca para incluir nome, turma e tipo
                  value={`${student.name} ${student.class} ${student.type}`}
                  onSelect={() => {
                    onChange(student.id)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between space-x-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === student.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Turma: {student.class} | Tipo: {student.type}
                    </p>
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