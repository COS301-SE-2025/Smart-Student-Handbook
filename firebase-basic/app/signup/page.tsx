import { SignupForm } from "@/components/signup-form"

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full bg-mute bg-center flex items-center justify-center"
    >
      <div className="w-full max-w-sm md:max-w-3xl">
        <SignupForm />
      </div>
    </div>
  )
}
