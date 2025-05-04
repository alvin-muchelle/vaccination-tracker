import { useEffect, useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "./components/mode-toggle"
import { DataTable } from "./components/data-table"
import { columns } from "./components/columns"
import { SignupForm } from "./components/SignUpForm"
import { ResetPasswordForm } from "./components/ResetPasswordForm"
import type { Vaccination } from "./components/columns"

function App() {
  const [data, setData] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [mustReset, setMustReset] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken")
    if (storedToken) {
      setAuthToken(storedToken)
    }
  }, [])

  useEffect(() => {
    if (!authToken || mustReset) return

    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/vaccination-schedule", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("Error fetching vaccination data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authToken, mustReset])

  const handleLoginSuccess = (token: string, mustResetPassword: boolean) => {
    setAuthToken(token)
    setMustReset(mustResetPassword)
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="p-6">
        <ModeToggle />

        {/* Conditional Header */}
        <h1 className="text-2xl font-bold mb-4 text-center">
          {!authToken ? 
          "Welcome to Chanjo"
          : mustReset ?
          "Reset Password"
          : 
          "Vaccination Schedule"
          }
        </h1>

        {/* Conditional Form or Data Table */}
        {!authToken ? (
          <SignupForm
          onLoginSuccess={(token, mustReset) =>
            handleLoginSuccess(token, mustReset)
          }
        />
      ) : mustReset ? (
        <ResetPasswordForm
          token={authToken}
          onResetComplete={() => setMustReset(false)}
        />
      ) : loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable columns={columns} data={data} />
      )}
      </div>
    </ThemeProvider>
  )
}

export default App
