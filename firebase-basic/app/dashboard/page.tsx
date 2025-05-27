'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, fs } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { sendTestNote } from "@/utils/SaveNotesButton";
import { Header } from '@/components/ui/header';
import { addFriend } from "@/utils/SaveFriends";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Calendar, Heart, Share2, Star, FileText, Plus } from 'lucide-react';

// Dummy data for My Notebooks
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
];

// Dummy data for Friends
const friends = [
  { name: "Ndhlovu Tanaka", role: "Student" },
  { name: "Takudzwa Magunda", role: "Lecturer" },
  { name: "Reinhard Pretorious", role: "Tutor" },
];

// Dummy data for Upcoming Events
const upcomingEvents = [
  { title: "COS301", type: "lecture", date: "Sat, 5 May", time: "08:00" },
  { title: "COS332", type: "exam", date: "Tue, 5 June", time: "08:00" },
];

// Dummy study hours data (for the bar chart)
const studyHours = [2, 5, 8]; // Representing hours for 3 days

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userData, setUserData] = useState<{ note?: string; title?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);

        const userDocRef = doc(fs, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          console.warn('No such user document!');
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!userEmail) return <p>Loading...</p>;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header at the top, full width */}
      <Header />

      {/* Container for Sidebar and Main Content */}
      <div className="flex flex-1">
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <SidebarTrigger />
            <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* My Notebooks Section */}
              <div className="col-span-1 bg-card p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">My Notebooks</h2>
                  <div className="flex gap-2">
                    <Link href="#">
                      <Button variant="ghost" size="icon">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm">Filter</Button>
                    <Button variant="ghost" size="sm">Sort</Button>
                    <Button variant="ghost" size="sm">Tags</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {notebooks.map((notebook) => (
                    <Link href="#" key={notebook.title}>
                      <div className="border-b py-2 hover:bg-muted/50 transition-colors">
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
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                              className={`px-2 py-1 rounded ${
                                notebook.tagType === "important" ? "bg-red-100 text-red-800" : "bg-gray-100"
                              }`}
                            >
                              {notebook.tag}
                            </span>
                            <span>{notebook.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Heart className="h-4 w-4 mr-1" />
                              {notebook.likes}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
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
              <div className="col-span-1 bg-card p-4 rounded-lg shadow">
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
                <div className="space-y-4">
                  {friends.map((friend) => (
                    <Link href="#" key={friend.name}>
                      <div className="flex items-center justify-between hover:bg-muted/50 transition-colors p-2 rounded">
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
                          <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                          <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                          <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                        </Button>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Upcoming Events and Total Study Hours Section */}
              <div className="col-span-1 space-y-4">
                {/* Upcoming Events Section */}
                <div className="bg-card p-4 rounded-lg shadow">
                  <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
                  <div className="space-y-4">
                    {upcomingEvents.map((event) => (
                      <Link href="#" key={event.title}>
                        <div className="flex items-center gap-3 hover:bg-muted/50 transition-colors p-2 rounded">
                          <div className="p-2 bg-muted rounded">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{event.title} {event.type}</p>
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
                <div className="bg-card p-4 rounded-lg shadow">
                  <h2 className="text-lg font-semibold mb-4">Total Study Hours</h2>
                  <div className="flex items-end gap-2 h-20">
                    {studyHours.map((hours, index) => (
                      <div
                        key={index}
                        className="bg-muted w-8 rounded"
                        style={{ height: `${hours * 10}px` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}