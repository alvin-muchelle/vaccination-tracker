import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "./components/mode-toggle";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { SignupForm } from "./components/SignUpForm";
import { LoginForm } from "./components/LoginForm";
import { Button } from "@/components/ui/button"
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { ProfileForm } from "./components/ProfileForm";
import { AddBabyForm } from "./components/AddBabyForm";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import type { Vaccination } from "./components/columns";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_BACKEND_URL as string;


interface Baby {
  id: string;
  baby_name: string;
  date_of_birth: string;
  gender: string;
}

interface ProfileResponse {
  mustResetPassword: boolean;
  profileComplete: boolean;
  mother: { id: number; full_name: string; phone_number: string } | null;
  babies: Baby[];
}

function App() {
  const [data, setData] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [mustReset, setMustReset] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [view, setView] = useState<"signup" | "login" | "reset" | "profile" | "dashboard">("signup");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [showAddBabyForm, setShowAddBabyForm] = useState(false);

  // Load token from localStorage on initial render
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      setAuthToken(storedToken);
    }
  }, []);

  // Fetch profile and determine the correct view
  useEffect(() => {
    const fetchProfileAndDetermineView = async () => {
      if (!authToken) return;
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json: ProfileResponse = await res.json();
        setMustReset(json.mustResetPassword);
        setProfileComplete(json.profileComplete);
        setProfile(json);

        // Set default baby if available
        if (json.babies.length > 0) {
          setSelectedBabyId(json.babies[0].id);
        }

        // Determine view based on profile status
        if (json.mustResetPassword) {
          setView("reset");
        } else if (!json.profileComplete) {
          setView("profile");
        } else {
          setView("dashboard");
        }
      } catch (e) {
        console.error("Failed to fetch profile:", e);
        toast.error("Failed to load profile data");
      }
    };

    fetchProfileAndDetermineView();
  }, [authToken]);

  // Fetch vaccination schedule when appropriate
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!authToken || mustReset || !profileComplete) return;

      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/vaccination-schedule`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        setData(await res.json());
      } catch (e) {
        console.error("Failed to fetch schedule:", e);
        toast.error("Failed to load vaccination schedule"); // Updated toast usage
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [authToken, mustReset, profileComplete]);

  // Schedule reminders when entering dashboard
  useEffect(() => {
    const scheduleReminders = async () => {
      if (view !== "dashboard" || !authToken || !selectedBabyId) return;

      try {
        const res = await fetch(`${API_BASE}/api/reminder/${selectedBabyId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!res.ok) {
          throw new Error("Reminder scheduling failed");
        }

        console.log("Reminder scheduled successfully");
      } catch (err) {
        console.error("Could not schedule reminders:", err);
        toast.warning("Failed to schedule reminders"); // Updated toast usage
      }
    };

    scheduleReminders();
  }, [view, authToken, selectedBabyId]);

  const handleProfileComplete = async () => {
  try {
    // Refresh profile data after completion
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    if (res.ok) {
      const json: ProfileResponse = await res.json();
      setProfile(json);
      setProfileComplete(true);
      
      // Set default baby if available
      if (json.babies.length > 0) {
        setSelectedBabyId(json.babies[0].id);
      }
      
      setView("dashboard");
    } else {
      throw new Error("Failed to fetch updated profile");
    }
  } catch (error) {
    console.error("Profile completion error:", error);
    toast.error("Failed to load baby data");
    // Stay on profile page if there's an error
  }
};
  const handleBabyAdded = async () => {
    try {
      // Refresh profile data
      const res = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (res.ok) {
        const json: ProfileResponse = await res.json();
        setProfile(json);
        
        // Select the newly added baby (last in the array)
        if (json.babies.length > 0) {
          setSelectedBabyId(json.babies[json.babies.length - 1].id);
        }
        
        toast.success("Baby added successfully!");
      } else {
        throw new Error("Failed to refresh profile");
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
      toast.error("Failed to load updated baby data");
    } finally {
      setShowAddBabyForm(false);
    }
  };

   const getSelectedBaby = () => {
    if (!profile?.babies || profile.babies.length === 0) return null;
    return selectedBabyId 
      ? profile.babies.find(b => b.id === selectedBabyId) 
      : profile.babies[0];
  };

  function renderView() {
    switch (view) {
      case "signup":
        return (
          <SignupForm
            onSignupSuccess={t => { 
              setTempToken(t);
              setView("reset");
            }}
            onSwitchToLogin={() => setView("login")}
          />
        );
      case "reset":
        return (
          <ResetPasswordForm
            token={tempToken || authToken || ""}
            onResetComplete={() => { setTempToken(null); setView("login"); }}
          />
        );
      case "login":
        return (
          <LoginForm
            onLoginSuccess={(token, must) => {
              localStorage.setItem("authToken", token);
              setAuthToken(token);
              setMustReset(must);
              if (must) {
                setView("reset");
              }
            }}
            onSwitchToSignup={() => setView("signup")}
          />
        );
      case "profile":
        return authToken ? (
          <ProfileForm
            token={authToken}
            onProfileComplete={handleProfileComplete}
          />
        ) : <p>Unauthorized</p>;
      case "dashboard":
        if (!profile) return <p>Loading profile…</p>;
        if (loading) return <p>Loading schedule…</p>;
        
        if (!profile.babies || profile.babies.length === 0) {
          return (
            <div className="text-center py-8">
              <p className="text-lg mb-4">No baby data available</p>
              <Button 
                onClick={() => setView("profile")}
                variant="outline"
              >
                Add Baby Information
              </Button>
            </div>
          );
        }

        const selectedBaby = (selectedBabyId 
          ? profile.babies.find(b => b.id === selectedBabyId)
          : profile.babies[0]) || profile.babies[0];

        if (!selectedBaby) {
          return <p>Error: No valid baby selected</p>;
        }

        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-8"> 
                <Button 
                  onClick={() => setShowAddBabyForm(!showAddBabyForm)}
                  variant="outline"
                  className="whitespace-nowrap border-primary"
                >
                  {showAddBabyForm ? "Cancel" : "Add Another Baby"}
                </Button>

                {profile.babies.length > 1 && (
                  <Select
                    onValueChange={val => setSelectedBabyId(val)}
                    value={selectedBabyId ? String(selectedBabyId) : ""}
                  >
                    <SelectTrigger className="w-[200px]">
                      <div className="w-full text-left font-normal text-muted-foreground">
                        Select a baby
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {profile.babies.map(b => (
                        <SelectItem key={b.id} value={(b.id)}>
                          {b.baby_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {showAddBabyForm && authToken && (
              <AddBabyForm 
                token={authToken} 
                onSuccess={handleBabyAdded} 
              />
            )}

            <DataTable
              columns={columns}
              data={data}
              initialBirthDate={selectedBaby.date_of_birth}
              babyId={selectedBaby.id}
              authToken={authToken!}
            />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="p-6">
        <ModeToggle />
        <h1 className="text-2xl font-bold mb-4 text-center">
          {view === "signup" ? "Welcome to Chanjo Chonjo!" : 
          view === "login" ? "Log In" :
          view === "reset" ? "Reset Password" :
          view === "profile" ? "Complete Your Profile" :
          `${getSelectedBaby()?.baby_name || 'Vaccination Schedule'}'s Vaccination Schedule`}
        </h1>
        {renderView()}
      </div>
    </ThemeProvider>
  );
}

export default App;