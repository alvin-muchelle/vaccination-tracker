"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as React from "react"
import { useState } from 'react';
import { ColumnResizer } from "./ColumnResizer"
import { calculateVaccinationSchedule } from "./calculateSchedule"

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
}

export function DataTable({
  columns,
  data,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const [rowSelection, setRowSelection] = React.useState({})

  const [birthDate, setBirthDate] = useState<string>('');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthDate(e.target.value);
  };

  const parsedBirthDate = birthDate ? new Date(birthDate) : new Date();
  const schedule = calculateVaccinationSchedule(data, parsedBirthDate);

  const table = useReactTable({
    columns,
    data: schedule,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    columnResizeMode: "onChange",
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div>
      <div className="py-4 text-sm text-muted-foreground">
        <p><strong>* Rotavirus 3rd dose alternate schedule</strong></p>
        <p><strong>** Vitamin A is given after every 6 months up to 5 years and lactating months too.</strong></p>
        <p><strong>*** One Dose Annually</strong></p>
      </div>
      <div className="flex items-center py-4">
      <Input
        type="date"
        value={birthDate}
        onChange={handleDateChange}
        className="max-w-xs"
      />

        <Input
          placeholder="Search for vaccine"
          value={(table.getColumn("vaccine")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("vaccine")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
      <div className="overflow-x-auto w-full rounded-md border">
        <Table className="min-w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                    key={header.id} 
                    className="relative border border-gray-200 px-2 py-1
                              truncate whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                    }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    <ColumnResizer header={header} />
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      minWidth: cell.column.getSize(),
                    }}
                    className="truncate whitespace-nowrap overflow-hidden text-ellipsis 
                              border border-gray-200 px-2 py-1"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}