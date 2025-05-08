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

function App() {
  const [data, setData] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [mustReset, setMustReset] = useState(false)
  const [profileComplete, setProfileComplete] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [view, setView] = useState<"signup" | "login" | "reset" | "profile" | "dashboard">("signup")

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken")
    if (storedToken) {
      setAuthToken(storedToken)
    }
  }, [])
  
  useEffect(() => {
    const fetchProfileStatus = async () => {
      if (!authToken) return;
  
      try {
        const res = await fetch("http://localhost:5000/api/profile", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
  
        if (res.ok) {
          const data = await res.json();
          setMustReset(data.mustResetPassword);
          setProfileComplete(data.profileComplete);
  
          // Update view accordingly
          if (data.mustResetPassword) {
            setView("reset");
          } else if (!data.profileComplete) {
            setView("profile");
          } else {
            setView("dashboard");
          }
        } else {
          console.error("Failed to fetch profile status");
        }
      } catch (err) {
        console.error("Error fetching profile status:", err);
      }
    };
  
    fetchProfileStatus();
  }, [authToken]);
  

  useEffect(() => {
    const fetchVaccinationSchedule = async () => {
      if (!authToken || mustReset || !profileComplete) return;
      
      setLoading(true);
      try {
        const res = await fetch("http://localhost:5000/api/vaccination-schedule", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
  
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          console.error("Failed to fetch vaccination schedule");
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchVaccinationSchedule();
  }, [authToken, mustReset, profileComplete]);
  

  function renderView() {
    switch (view) {
      case "signup":
        return (
          <SignupForm
            onSignupSuccess={token => {
              setTempToken(token)
              setView("reset")
            }}
            onSwitchToLogin={() => setView("login")}
          />
        )
  
      case "reset":
        return (
          <ResetPasswordForm
            token={tempToken ?? ""}
            onResetComplete={() => {
              setTempToken(null)
              setView("login")
            }}
          />
        )
  
      case "login":
        return (
          <LoginForm
            onLoginSuccess={async (token, mustReset) => {
              setAuthToken(token)
              setMustReset(mustReset)
  
              if (mustReset) {
                setView("reset")
                return
              }
  
              try {
                const res = await fetch("/api/profile", {
                  headers: { Authorization: `Bearer ${token}` },
                })
                const profile = await res.json()
                if (profile.profileComplete) {
                  setProfileComplete(true)
                  setView("dashboard")
                } else {
                  setView("profile")
                }
              } catch (err) {
                console.error("Error fetching profile:", err)
                setView("profile")
              }
            }}
          />
        )
  
      case "profile":
        if (authToken) {
          return (
            <ProfileForm
              token={authToken}
              onProfileComplete={() => {
                setProfileComplete(true)
                setView("dashboard")
              }}
            />
          )
        }
        return <p>Unauthorized</p>
  
      case "dashboard":
        return loading ? <p>Loading...</p> : <DataTable columns={columns} data={data} />
      default:
        return <p>Invalid view</p>
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
            dashboard: "Vaccination Schedule",
          }[view]}
        </h1>
        {renderView()}
      </div>
    </ThemeProvider>
  )
}

export default App