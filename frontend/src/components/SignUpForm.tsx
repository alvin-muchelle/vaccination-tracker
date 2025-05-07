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

interface Props {
  onSignupSuccess: (token: string) => void
  onSwitchToLogin: () => void
}

export function SignupForm({ onSignupSuccess, onSwitchToLogin }: Props) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  })

  const handleSendEmail = async (values: z.infer<typeof emailSchema>) => {
    setSending(true)
    setMessage("")
    try {
      const res = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessage("Temporary password sent. Check your email.")
        onSignupSuccess(data.token)
      } else {
        setMessage(data.message || "Signup failed.")
      }
    } catch (err) {
      console.error(err)
      setMessage("Error sending email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-xl font-semibold mb-4">Sign Up</h2>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSendEmail)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormDescription>
                  We'll send you a temporary password to get started.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send Temporary Password"}
          </Button>
        </form>
      </Form>

      {message && (
        <p className="mt-4 text-center text-sm text-green-600">{message}</p>
      )}

      <p className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="underline text-blue-500 hover:text-blue-700"
        >
          Log in
        </button>
      </p>
    </div>
  )
}
