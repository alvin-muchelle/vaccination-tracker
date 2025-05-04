// components/ResetPasswordForm.tsx

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form"

const schema = z.object({
  newPassword: z.string().min(6, "Minimum 6 characters"),
})

export function ResetPasswordForm({
  token,
  onResetComplete,
}: {
  token: string 
  onResetComplete: () => void
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      const res = await fetch("http://localhost:5000/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: values.newPassword }),
      })

      if (res.ok) {
        localStorage.setItem("authToken", token)
        onResetComplete()
      } else {
        console.error("Reset failed")
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-xl font-semibold mb-4">Reset Your Password</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="New password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Reset Password</Button>
        </form>
      </Form>
    </div>
  )
}
