
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as React from "react"
import { useState, useEffect } from 'react';
import { ColumnResizer } from "./ColumnResizer"
import { calculateVaccinationSchedule } from "./calculateSchedule"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

// Pull in the backend URL from my env
const API_BASE = import.meta.env.VITE_BACKEND_URL as string;

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx"
import { Vaccination } from "./columns";

interface DataTableProps {
  columns: ColumnDef<Vaccination, any>[]
  data: Vaccination[]
  initialBirthDate?: string
  babyId?: number
  authToken: string
}

// helper to format a Date to YYYY-MM-DD in local timezone
function formatLocalDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DataTable({
  columns,
  data,
  initialBirthDate,
  babyId,
  authToken,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // sync birthDate state when initialBirthDate prop changes
  const [birthDate, setBirthDate] = useState<string>(initialBirthDate ?? "")
  useEffect(() => {
    setBirthDate(initialBirthDate ?? "")
  }, [initialBirthDate])

  const [popoverOpen, setPopoverOpen] = useState(false)

  // only compute schedule when we have a valid birthDate
  const parsedBirthDate = birthDate ? new Date(birthDate) : null;
  const schedule = React.useMemo(
    () => (parsedBirthDate ? calculateVaccinationSchedule(data, parsedBirthDate) : []),
    [data, parsedBirthDate]
  );

  // when baby changes, reset to first page
  useEffect(() => {
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }, [babyId])

  const handleDateSelect = async (day: Date | undefined) => {
    if (!day) return;
    // format using local date parts rather than toISOString
    const iso = formatLocalDate(day)
    setBirthDate(iso)
    setPopoverOpen(false)

    await fetch(`${API_BASE}/api/baby/${babyId}/birth-date`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ birthDate: iso }),
    })
  }

  const table = useReactTable({
    columns,
    data: schedule,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    columnResizeMode: "onChange",
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection, pagination },
    autoResetPageIndex: false,
  })

  return (
    <div>
      <div className="py-4 text-sm text-muted-foreground">
        <p><strong>* Rotavirus 3rd dose alternate schedule</strong></p>
        <p><strong>** Vitamin A is given after every 6 months up to 5 years and lactating months too.</strong></p>
        <p><strong>*** One Dose Annually</strong></p>
      </div>
      <div className="flex items-center py-4">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="max-w-xs w-[220px] justify-start text-left font-normal text-muted-foreground">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Pick new birth date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 space-y-2" align="start">
            <p className="text-sm text-muted-foreground px-1">Has the baby’s birth date changed?</p>
            <Calendar
              mode="single"
              selected={birthDate ? new Date(birthDate) : undefined}
              onSelect={handleDateSelect}
            />
          </PopoverContent>
        </Popover>
        <Input
          placeholder="Search for vaccine"
          value={(table.getColumn("vaccine")?.getFilterValue() as string) ?? ""}
          onChange={e => table.getColumn("vaccine")?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="overflow-x-auto w-full rounded-md border">
        <Table className="min-w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className="relative border border-gray-200 px-2 py-1 truncate whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ width: header.getSize(), minWidth: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    <ColumnResizer header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                      className="truncate whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200 px-2 py-1"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
      </div>
    </div>
  )
}
