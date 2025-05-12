import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

// Pull in the backend URL from my env
const API_BASE = import.meta.env.VITE_BACKEND_URL as string;

const resetSchema = z
  .object({
    tempPassword: z.string().min(6, "Temporary password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

interface ResetPasswordFormProps {
  token: string
  onResetComplete: () => void
}

export function ResetPasswordForm({ token, onResetComplete }: ResetPasswordFormProps) {
  const [message, setMessage] = useState("")
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      tempPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const handleReset = async (values: z.infer<typeof resetSchema>) => {
    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tempPassword: values.tempPassword,
          newPassword: values.newPassword,
        }),
      })

      if (res.ok) {
        setMessage("Password reset successful. Please log in.")
        onResetComplete()
      } else {
        const data = await res.json()
        setMessage(data.message || "Reset failed.")
      }
    } catch (err) {
      console.error(err)
      setMessage("Something went wrong.")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-xl font-semibold mb-4">Reset Password</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleReset)} className="space-y-4">
          <FormField
            control={form.control}
            name="tempPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Reset Password</Button>
        </form>
      </Form>

      {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
    </div>
  )
}
