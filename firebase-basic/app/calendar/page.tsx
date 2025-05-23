'use client'

import { CalendarDemo } from "@/components/calendar-demo"

export default function CalendarPage() {
  return (
    <main className="flex flex-col items-center p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>
      <CalendarDemo />
    </main>
  )
}
