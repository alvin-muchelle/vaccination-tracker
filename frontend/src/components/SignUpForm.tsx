"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export function SignupForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (token: string, mustResetPassword: boolean) => void
}) {
  const [message, setMessage] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  })

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const handleSendEmail = async (values: z.infer<typeof emailSchema>) => {
    try {
      const res = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      })

      if (res.ok) {
        setMessage("Temporary password sent. Check your email.")
        setEmailSent(true)
        loginForm.setValue("email", values.email) 
      } else {
        const data = await res.json()
        setMessage(data.message || "Signup failed.")
      }
    } catch (err) {
      console.error(err)
      setMessage("Error sending email.")
    }
  }

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await res.json()
      if (res.ok && data.token) {
        onLoginSuccess(data.token, data.mustResetPassword ?? false)
      } else {
        setMessage("Login failed. Check your temporary password.")
      }
    } catch (err) {
      console.error(err)
      setMessage("Error logging in.")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-xl font-semibold mb-4">Sign Up</h2>

      {!emailSent ? (
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(handleSendEmail)}
            className="space-y-4"
          >
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    We'll send you a temporary password.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Send Temporary Password</Button>
          </form>
        </Form>
      ) : (
        <Form {...loginForm}>
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="space-y-4"
          >
            <FormField
              control={loginForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input disabled {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={loginForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Log In</Button>
          </form>
        </Form>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-green-600">{message}</p>
      )}
    </div>
  )
}
