import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form"

// Pull in the backend URL from my env
const API_BASE = import.meta.env.VITE_BACKEND_URL as string;

const schema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    babyName: z.string().min(1, "Baby name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["Male", "Female"], {
      errorMap: () => ({ message: "Gender is required" }),
    }),  
})

export function ProfileForm({
  token,
  onProfileComplete,
}: {
  token: string
  onProfileComplete: () => void
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (values: z.infer<typeof schema>) => {
  try {
    setServerError(null) // Clear any previous error

    const res = await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(values),
    })

    const data = await res.json()

    if (res.ok) {
      onProfileComplete()
    } else {
      // If Express returned { error: "..." }
      setServerError(data.error || "Something went wrong")
    }
  } catch (err) {
    setServerError("Network error. Please try again.")
    console.error(err)
  }
}


    return (
        <div className="max-w-md mx-auto mt-10">
            <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Your Full Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Jane Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Your Phone Number</FormLabel>
                            <FormControl>
                                <Input placeholder="0712345678" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="babyName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Baby's Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Baby Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Gender</FormLabel>
                                <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {serverError && (
                      <div className="text-red-600 text-sm mb-4 text-center">
                        {serverError}
                      </div>
                    )}
                    <div className="flex justify-center">
                        <Button type="submit">Save Profile</Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
