import './App.css'
import { useEffect, useState } from 'react'
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from './components/mode-toggle'
import { DataTable } from './components/data-table'
import { columns } from './components/columns'
import type { Vaccination } from './components/columns'

function App() {
  const [data, setData] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/vaccination-schedule')
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('Error fetching vaccination data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="p-6">
        <ModeToggle />
        <h1 className="text-2xl font-bold mb-4">Vaccination Schedule</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <DataTable columns={columns} data={data} />
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
