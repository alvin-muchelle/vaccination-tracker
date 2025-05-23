import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Pull in the backend URL from my env
const API_BASE = import.meta.env.VITE_BACKEND_URL as string;

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

interface Props {
  onLoginSuccess: (token: string, mustReset: boolean) => void
  onSwitchToSignup: () => void
}

export function LoginForm({ onLoginSuccess, onSwitchToSignup }: Props) {
  const [errorMsg, setErrorMsg] = useState("")
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setErrorMsg("")
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (res.ok) {
        onLoginSuccess(data.token, data.mustReset)
        localStorage.setItem("authToken", data.token)
      } else {
        setErrorMsg(data.error || "Login failed")
      }
    } catch {
      setErrorMsg("Network error")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-xl font-semibold mb-4">Log In</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">Log In</Button>
        </form>
      </Form>

      <div className="mt-4 text-center">
        <Button 
          variant="link" 
          onClick={onSwitchToSignup}
          className="text-sm"
        >
          Don't have an account? Sign up
        </Button>
      </div>

      {errorMsg && <p className="mt-4 text-red-600 text-sm text-center">{errorMsg}</p>}
    </div>
  )
}