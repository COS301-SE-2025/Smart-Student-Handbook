import StudentCalendar from "@/components/ui/student-calendar"
import { PageHeader } from "@/components/ui/page-header"

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Calendar"
        description="Manage your academic schedule, track events, and organize your lecture timetable."
      />

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <StudentCalendar />
        </div>
      </div>
    </div>
  )
}
