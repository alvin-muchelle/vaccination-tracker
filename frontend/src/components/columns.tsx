"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Vaccination = {
  id: number
  age: string
  vaccine: string
  protection_against: string
}

export const columns: ColumnDef<Vaccination>[] = [
  {
    accessorKey: "age",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Age
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },

    sortingFn: (rowA, rowB) => {
      const orderValue = (age: string): number => {
        if (age.toLowerCase() === "birth") return 0;
    
        const unitWeights: Record<string, number> = {
          "week": 1,
          "weeks": 1,
          "month": 4,
          "months": 4,
          "year": 52,
          "years": 52,
        };
    
        // Match patterns like "15–18 months", "1–2 years", "6 months"
        const rangeRegex = /^(\d+)[–-](\d+)\s*(\w+)/;
        const singleRegex = /^(\d+)\s*(\w+)/;
    
        const rangeMatch = age.match(rangeRegex);
        if (rangeMatch) {
          const [, start, end, unit] = rangeMatch;
          const startVal = parseInt(start) * (unitWeights[unit.toLowerCase()] || 1000);
          const endVal = parseInt(end) * (unitWeights[unit.toLowerCase()] || 1000);
          return (startVal + endVal) / 2;
        }
    
        const singleMatch = age.match(singleRegex);
        if (singleMatch) {
          const [, num, unit] = singleMatch;
          return parseInt(num) * (unitWeights[unit.toLowerCase()] || 1000);
        }
    
        return 9999; // fallback for unrecognized patterns
      };
    
      return orderValue(rowA.getValue("age")) - orderValue(rowB.getValue("age"));
    }    
  },

  {
    accessorKey: "vaccine",
    header: "Vaccine",
  },
  {
    accessorKey: "protection_against",
    header: "Protection Against",
  },
]