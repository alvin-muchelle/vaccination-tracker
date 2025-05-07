import { useState } from "react"

interface Props {
  onLoginSuccess: (token: string, mustReset: boolean) => void
}

export function LoginForm({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (res.ok) {
        onLoginSuccess(data.token, data.mustReset)
        localStorage.setItem("authToken", data.token)
      } else {
        alert(data.error || "Login failed")
      }
    } catch (err) {
      alert("Network error")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full p-2 rounded bg-gray-800 text-white"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full p-2 rounded bg-gray-800 text-white"
      />
      <button type="submit" className="bg-blue-500 px-4 py-2 rounded text-white">
        Log In
      </button>
    </form>
  )
}
