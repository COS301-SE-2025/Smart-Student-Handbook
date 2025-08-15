// components/signup-form.tsx

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Image from "next/image"

export function SignupForm(
  { className, ...props }: React.ComponentProps<'div'>,
) {
  const router = useRouter()

  const [name, setName] = React.useState('')
  const [surname, setSurname] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedFirst = name.trim()
    const trimmedSurname = surname.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim();


    if (!trimmedFirst || !trimmedSurname) {
      setError('Please provide both first name and surname.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
 
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    try {
      setIsLoading(true)

      const { user } = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword,
      )

      // Update displayName in Auth
      await updateProfile(user, {
        displayName: `${trimmedFirst} ${trimmedSurname}`,
      })
      
      // 🟢 Save profile in Realtime Database: /users/{uid}
      await set(ref(db, `users/${user.uid}`), {
        name: trimmedFirst,
        surname: trimmedSurname,
        role: 'User',
        email: user.email,
        createdAt: Date.now(),
      })

      router.push('/dashboard')
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props} data-testid="root-div">
      <Card className="overflow-hidden w-full max-w-3xl">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSignup} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Create Account</h1>
                <p className="text-sm text-muted-foreground">
                  Join the Smart Student community
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="name-input"
                />
              </div>

              <div className="grid gap-2">
              <Label htmlFor="surname">Surname</Label>
                  <Input
                  id="surname"
                  type="text"
                  placeholder="Your surname"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
              />
              </div>


              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="password-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !name || !email || !password}
                data-testid="submit-button"
              >
                {isLoading ? (
                  <>
                    <Loader2 
                      className="w-4 h-4 animate-spin mr-2" 
                      data-testid="loader-icon" 
                    />
                    Signing up…
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>

              {error && (
                <p 
                  className="text-sm text-red-500 text-center" 
                  data-testid="error-message"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </p>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <a
                  href="/login"
                  className="underline underline-offset-4"
                >
                  Log in
                </a>
              </p>
            </div>
          </form>

          {/* ── Side image ── */}
          {/* right: logo panel */}
            <div className="hidden md:flex items-center justify-center bg-white p-0">
              <div className="relative w-120 h-120">
                <Image
                  src="/sshblogo.png"
                  alt="Smart Student Handbook Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center [&_a]:underline">
        By signing up, you agree to our{' '}
        <a href="#">Terms</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </p>
    </div>
  )
}
