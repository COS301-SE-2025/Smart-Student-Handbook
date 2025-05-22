import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"

import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      await new Promise((res) => setTimeout(res, 1500)) // simulate login delay

      // Save user to localStorage
      localStorage.setItem("user", JSON.stringify({ email: data.email }))

      toast.success("Login successful", {
        description: `Welcome, ${data.email}`,
      })

      setTimeout(() => {
        navigate("/dashboard")
      }, 1000)

    } catch (err) {
      toast.error("Login failed", {
        description: "Check your email or password.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6">
      <Card className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Login
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <p className="text-red-500 text-sm">{errors.password.message}</p>
            )}
          </div>
          <div className="flex justify-between text-sm text-blue-600">
            <a href="#" className="hover:underline">Forgot password?</a>
            <a href="#" className="hover:underline">Sign up</a>
          </div>
          <Button type="submit" className="w-full mt-4" disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Signing In...
              </div>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
