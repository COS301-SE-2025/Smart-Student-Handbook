"use client";

import StudentCalendar from "@/components/ui/student-calendar";

export default function Home() {
  return (
    /* full-width wrapper that can grow up to 1440 px */
    <div className="w-full max-w-[1440px] mx-auto space-y-8 px-4 lg:px-8 py-6">
      <h1 className="text-3xl font-bold text-center">Student Calendar</h1>

      {/* let the calendar widen naturally on desktop */}
      <StudentCalendar />
    </div>
  );
}
