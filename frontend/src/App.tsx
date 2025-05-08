import { useEffect, useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "./components/mode-toggle"
import { DataTable } from "./components/data-table"
import { columns } from "./components/columns"
import { SignupForm } from "./components/SignUpForm"
import { LoginForm } from "./components/LoginForm"
import { ResetPasswordForm } from "./components/ResetPasswordForm"
import { ProfileForm } from "./components/ProfileForm"
import type { Vaccination } from "./components/columns"

interface ProfileResponse {
  mustResetPassword: boolean
  profileComplete: boolean
  mother: { id: number; full_name: string; phone_number: string } | null
  baby: { id: number; baby_name: string; date_of_birth: string; gender: string } | null
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
        const res = await fetch("http://localhost:5000/api/profile", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (res.ok) {
          const json: ProfileResponse = await res.json()
          setMustReset(json.mustResetPassword)
          setProfileComplete(json.profileComplete)
          setProfile(json)
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
        const res = await fetch("http://localhost:5000/api/vaccination-schedule", {
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

   // once we enter the dashboard, fire /api/reminder
   useEffect(() => {
      if (view === "dashboard" && authToken) {
        fetch("http://localhost:5000/api/reminder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        })
          .then((res) => {
            if (!res.ok) throw new Error("reminder scheduling failed");
            return res.json();
          })
          .then((j) => console.log("reminder scheduled:", j))
          .catch((err) => console.error("could not schedule reminders:", err));
      }
       }, [view, authToken]);
    

  function renderView() {
    switch (view) {
      case "signup":
        return (
          <SignupForm
            onSignupSuccess={t => { setTempToken(t); setView("reset"); }}
            onSwitchToLogin={() => setView("login")}
          />
        )
      case "reset":
        return (
          <ResetPasswordForm
            token={tempToken ?? ""}
            onResetComplete={() => { setTempToken(null); setView("login"); }}
          />
        )
      case "login":
        return (
          <LoginForm
            onLoginSuccess={async (token, must) => {
              setAuthToken(token)
              setMustReset(must)
              if (must) { setView("reset"); return }
              // refresh profile
              setAuthToken(token)
            }}
          />
        )
      case "profile":
        return authToken ? (
          <ProfileForm
            token={authToken}
            onProfileComplete={() => { setProfileComplete(true); setView("dashboard"); }}
          />
        ) : <p>Unauthorized</p>
        case "dashboard": {
          // take the ISO string from the server, convert to local, format as YYYY‑MM‑DD
          const iso = profile?.baby?.date_of_birth
          const initialBirthDate = iso
            ? (() => {
                const d = new Date(iso)
                const y = d.getFullYear()
                const m = String(d.getMonth() + 1).padStart(2, "0")
                const day = String(d.getDate()).padStart(2, "0")
                return `${y}-${m}-${day}`
              })()
            : ""
          return loading ? <p>Loading...</p> : (
            <DataTable
              columns={columns}
              data={data}
              initialBirthDate={initialBirthDate}
              babyId={profile!.baby!.id}
              authToken={authToken!}
            />
          )
        } 
      default:
        return null
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="p-6">
        <ModeToggle />
        <h1 className="text-2xl font-bold mb-4 text-center">
          {{ signup: "Welcome to Chanjo", reset: "Reset Password", login: "Log In", profile: "Complete Your Profile", dashboard: "Vaccination Schedule" }[view]}
        </h1>
        {renderView()}
      </div>
    </ThemeProvider>
  )
}

export default App
