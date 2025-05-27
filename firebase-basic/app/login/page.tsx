import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-cover bg-center flex items-center justify-center"
    style={{ backgroundImage: "url('/background.jpg')" }}
    >
      <div className="w-full max-w-sm md:max-w-3xl">
        <LoginForm />
      </div>
    </div>
  )
}
