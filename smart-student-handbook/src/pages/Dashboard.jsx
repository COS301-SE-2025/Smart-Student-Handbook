import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"))
    if (!storedUser) {
      toast.warning("Please log in first.")
      navigate("/")
    } else {
      setUser(storedUser)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("user")
    toast.success("Logged out successfully")
    navigate("/")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 px-4 text-center">
      <h1 className="text-4xl font-bold text-blue-700 mb-4">
        Welcome, {user?.email || "Guest"} 
      </h1>
      <p className="text-gray-600 mb-8">
        You’ve successfully logged in to the Smart Student Handbook dashboard.
      </p>
      <button
        onClick={handleLogout}
        className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded shadow"
      >
        Logout
      </button>
    </div>
  )
}
