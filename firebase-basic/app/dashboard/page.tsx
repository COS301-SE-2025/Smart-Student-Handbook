import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Heart, Plus, Share2, Star } from "lucide-react"

const notebooks = [
  {
    title: "COS301 Computer Science Fundamentals",
    tag: "LECTURE",
    tagType: "important",
    timestamp: "Today at 2:30PM",
    likes: 1,
  },
  {
    title: "COS701 AI & Machine Learning Concepts",
    tag: "RESEARCH",
    tagType: "",
    timestamp: "Yesterday",
    likes: 1,
  },
  {
    title: "COS221 Database System Architecture",
    tag: "LECTURE",
    tagType: "",
    timestamp: "2 days ago",
    likes: 1,
  },
  {
    title: "COS301 Software Engineering Principles",
    tag: "EXAM",
    tagType: "important",
    timestamp: "1 week ago",
    likes: 1,
  },
]

const friends = [
  { name: "Ndhlovu Tanaka", role: "Student" },
  { name: "Takudzwa Magunda", role: "Lecturer" },
]

const upcomingEvents = [
  { title: "COS301", type: "lecture", date: "Sat, 5 May", time: "08:00" },
  { title: "COS332", type: "exam", date: "Tue, 5 June", time: "08:00" },
]

const studyHours = [2, 5, 8] // Representing hours for 3 days

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* My Notebooks Section */}
        <div className="col-span-1 bg-card p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">My Notebooks</h2>
            <div className="flex gap-2">
              <Link href="/notes">
                <Button variant="ghost" size="icon">
                  <Plus className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm">
                Filter
              </Button>
              <Button variant="ghost" size="sm">
                Sort
              </Button>
              <Button variant="ghost" size="sm">
                Tags
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {notebooks.map((notebook) => (
              <Link href="/notes" key={`${notebook.title}-${notebook.timestamp}`}>
                <div className="border-b py-3 hover:bg-muted/50 transition-colors rounded-md px-2">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{notebook.title}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Star className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${notebook.tagType === "important" ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}
                      >
                        {notebook.tag}
                      </span>
                      <span>{notebook.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
                        <Heart className="h-4 w-4 mr-1" />
                        {notebook.likes}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
                        <Share2 className="h-4 w-4 mr-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Friends Section */}
        <div className="col-span-1 bg-card p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Friends</h2>
            <Link href="#">
              <Button variant="ghost" size="icon">
                <Avatar className="h-6 w-6">
                  <AvatarFallback>+</AvatarFallback>
                </Avatar>
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {friends.map((friend) => (
              <Link href="#" key={friend.name}>
                <div className="flex items-center justify-between hover:bg-muted/50 transition-colors p-3 rounded-md">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{friend.name}</p>
                      <p className="text-sm text-muted-foreground">{friend.role}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <div className="flex gap-1">
                      <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                      <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                      <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                    </div>
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Events and Total Study Hours Section */}
        <div className="col-span-1 space-y-6">
          {/* Upcoming Events Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link href="/calendar" key={event.title}>
                  <div className="flex items-center gap-3 hover:bg-muted/50 transition-colors p-3 rounded-md">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-md">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {event.title} {event.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.date} {event.time}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Total Study Hours Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Total Study Hours</h2>
            <div className="flex items-end gap-3 h-24">
              {studyHours.map((hours, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-gradient-to-t from-amber-500 to-amber-400 w-8 rounded-t-md transition-all duration-300 hover:from-amber-600 hover:to-amber-500"
                    style={{ height: `${Math.max(hours * 8, 8)}px` }}
                  ></div>
                  <span className="text-xs text-muted-foreground">{hours}h</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Total this week: {studyHours.reduce((a, b) => a + b, 0)} hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
