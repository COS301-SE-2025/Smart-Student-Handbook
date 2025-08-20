'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { ref, set, get } from 'firebase/database'
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

    const trimmedName = name.trim()
    const trimmedSurname = surname.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName || !trimmedSurname) {
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

      // Create the account in Firebase Auth
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password)

      // Update displayName in Auth
      await updateProfile(user, {
        displayName: `${trimmedName} ${trimmedSurname}`,
      })

      // Save profile in Realtime Database: /users/{uid}/UserSettings
      const userSettingsRef = ref(db, `users/${user.uid}/UserSettings`)
      await set(userSettingsRef, {
        name: trimmedName,
        surname: trimmedSurname,
        email: trimmedEmail, // Explicitly save the email
        degree: '',
        occupation: '',
        hobbies: [],
        description: '',
      })

      // Check if user settings are incomplete
      const userSettingsSnapshot = await get(userSettingsRef)
      const userSettings = userSettingsSnapshot.val()
      const isIncomplete = !userSettings.degree || !userSettings.occupation || !userSettings.hobbies.length || !userSettings.description

      // Redirect based on completeness
      if (isIncomplete) {
        router.push('/profile') // Redirect to settings page
      } else {
        router.push('/dashboard') // Redirect to dashboard
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden w-full max-w-3xl">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Signup form */}
          <form onSubmit={handleSignup} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Create Account</h1>
                <p className="text-sm text-muted-foreground">
                  Join the Smart Student community
                </p>
              </div>

              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Surname */}
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

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing up…
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 text-center">
                  {error}
                </p>
              )}
            </div>
          </form>

          {/* Side image */}
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
    </div>
  )
}