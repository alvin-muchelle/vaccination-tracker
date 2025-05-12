import { useEffect, useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "./components/mode-toggle"
import { DataTable } from "./components/data-table"
import { columns } from "./components/columns"
import { SignupForm } from "./components/SignUpForm"
import { LoginForm } from "./components/LoginForm"
import { ResetPasswordForm } from "./components/ResetPasswordForm"
import { ProfileForm } from "./components/ProfileForm"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { Vaccination } from "./components/columns"

// Pull in the backend URL from my env
const API_BASE = import.meta.env.VITE_BACKEND_URL as string;

interface Baby {
  id: number
  baby_name: string
  date_of_birth: string
  gender: string
}

interface ProfileResponse {
  mustResetPassword: boolean
  profileComplete: boolean
  mother: { id: number; full_name: string; phone_number: string } | null
  babies: Baby[]
}

function App() {
  const [data, setData] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [mustReset, setMustReset] = useState(false)
  const [profileComplete, setProfileComplete] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [view, setView] = useState<"signup" | "login" | "reset" | "profile" | "dashboard">("signup")
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [selectedBabyId, setSelectedBabyId] = useState<number | null>(null)

  // load token
  useEffect(() => {
    const stored = localStorage.getItem("authToken")
    if (stored) setAuthToken(stored)
  }, [])

  // fetch profile status and data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!authToken) return
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (res.ok) {
          const json: ProfileResponse = await res.json()
          setMustReset(json.mustResetPassword)
          setProfileComplete(json.profileComplete)
          setProfile(json)
          // default-select first baby
          if (json.babies.length) setSelectedBabyId(json.babies[0].id)
          // decide view
          if (json.mustResetPassword) setView("reset")
          else if (!json.profileComplete) setView("profile")
          else setView("dashboard")
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchProfile()
  }, [authToken])

  // fetch schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!authToken || mustReset || !profileComplete) return
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/vaccination-schedule`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (res.ok) {
          setData(await res.json())
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [authToken, mustReset, profileComplete])

  // schedule reminders when entering dashboard
  useEffect(() => {
    if (view === "dashboard" && authToken && selectedBabyId !== undefined) {
      fetch(`${API_BASE}/api/reminder/${selectedBabyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      })
        .then(res => {
          if (!res.ok) throw new Error("reminder scheduling failed")
          return res.json()
        })
        .then(j => console.log("reminder scheduled:", j))
        .catch(err => console.error("could not schedule reminders:", err))
    }
  }, [view, authToken, selectedBabyId])

  function renderView() {
    switch (view) {
      case "signup":
        return (
          <SignupForm
            onSignupSuccess={t => { setTempToken(t); setView("reset") }}
            onSwitchToLogin={() => setView("login")}
          />
        )
      case "reset":
        return (
          <ResetPasswordForm
            token={tempToken ?? ""}
            onResetComplete={() => { setTempToken(null); setView("login") }}
          />
        )
      case "login":
        return (
          <LoginForm
            onLoginSuccess={(token, must) => {
              setAuthToken(token)
              setMustReset(must)
              if (must) { setView("reset"); return }
              setAuthToken(token)
            }}
          />
        )
      case "profile":
        return authToken ? (
          <ProfileForm
            token={authToken}
            onProfileComplete={() => { setProfileComplete(true); setView("dashboard") }}
          />
        ) : <p>Unauthorized</p>
      case "dashboard":
        if (!profile) return <p>Loading profile…</p>
        return loading ? <p>Loading schedule…</p> : (
          <div className="space-y-4">
            <Select
              onValueChange={val => setSelectedBabyId(Number(val))}
              defaultValue={selectedBabyId !== null ? String(selectedBabyId) : undefined}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Choose baby" />
              </SelectTrigger>
              <SelectContent>
                {profile.babies.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.baby_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedBabyId !== null && (
              <DataTable
                columns={columns}
                data={data}
                initialBirthDate={
                  profile.babies.find(b => b.id === selectedBabyId)!.date_of_birth
                }
                babyId={selectedBabyId}
                authToken={authToken!}
              />
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="p-6">
        <ModeToggle />
        <h1 className="text-2xl font-bold mb-4 text-center">
          {{
            signup: "Welcome to Chanjo",
            reset: "Reset Password",
            login: "Log In",
            profile: "Complete Your Profile",
            dashboard: "Vaccination Schedule"
          }[view]}
        </h1>
        {renderView()}
      </div>
    </ThemeProvider>
  )
}

export default App