"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { normalizeString } from "@/utils/stringUtils"
import { GraduationCap, User as UserIcon } from "lucide-react"
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
    return student ? `${student.name} (${student.class})` : "Selecione ou busque um aluno...";
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value, search) => {
          if (normalizeString(value).includes(normalizeString(search))) return 1;
          return 0;
        }}>
          <CommandInput placeholder="Buscar por nome, turma ou tipo..." />
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded flex items-center">
                        {student.type === 'PROFESSOR' ? <UserIcon className="h-2.5 w-2.5 mr-1" /> : <GraduationCap className="h-2.5 w-2.5 mr-1" />}
                        {student.class}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {student.type}
                      </span>
                    </div>
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