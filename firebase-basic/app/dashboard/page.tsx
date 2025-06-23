"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database"; // Realtime DB helpers
import { auth, db } from "@/lib/firebase"; // db is Realtime Database instance
import { useRouter } from "next/navigation";
import Link from "next/link";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Header } from "@/components/ui/header";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  Calendar as CalendarIcon,
  Heart,
  Share2,
  Star,
  FileText,
  Plus,
} from "lucide-react";

const notebooks = [
  { title: "COS301 Computer Science Fundamentals", tag: "LECTURE", tagType: "important", timestamp: "Today at 2:30PM", likes: 1 },
  { title: "COS701 AI & Machine Learning Concepts", tag: "RESEARCH", tagType: "", timestamp: "Yesterday", likes: 1 },
  { title: "COS221 Database System Architecture", tag: "LECTURE", tagType: "", timestamp: "2 days ago", likes: 1 },
  { title: "COS301 Software Engineering Principles", tag: "EXAM", tagType: "important", timestamp: "1 week ago", likes: 1 },
];

const friends = [
  { name: "Ndhlovu Tanaka", role: "Student" },
  { name: "Takudzwa Magunda", role: "Lecturer" },
];

const upcomingEvents = [
  { title: "COS301", type: "lecture", date: "Sat, 5 May", time: "08:00" },
  { title: "COS332", type: "exam", date: "Tue, 5 June", time: "08:00" },
];

const studyHours = [2, 5, 8];

type UserData = {
  note?: string;
  title?: string;
};

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        try {
          const userRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setUserData(snapshot.val());
          }
        } catch (err) {
          console.error("Error reading user data", err);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsub();
  }, [router]);

  if (!userEmail) return <p>Loading...</p>;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <SidebarTrigger />
            <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Notebooks */}
              <section className="bg-card p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">My Notebooks</h2>
                  <div className="flex gap-2">
                    <Link href="#"><Button variant="ghost" size="icon"><Plus className="h-5 w-5" /></Button></Link>
                    <Button variant="ghost" size="sm">Filter</Button>
                    <Button variant="ghost" size="sm">Sort</Button>
                    <Button variant="ghost" size="sm">Tags</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {notebooks.map((nb) => (
                    <Link href="#" key={`${nb.title}-${nb.timestamp}`}>
                      <div className="border-b py-2 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{nb.title}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon"><FileText className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon"><Star className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className={`px-2 py-1 rounded ${nb.tagType === "important" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>{nb.tag}</span>
                          <span>{nb.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="ghost" size="sm" className="text-muted-foreground"><Heart className="h-4 w-4 mr-1" />{nb.likes}</Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground"><Share2 className="h-4 w-4 mr-1" /></Button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Friends */}
              <section className="bg-card p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Friends</h2>
                  <Link href="#"><Button variant="ghost" size="icon"><Avatar className="h-6 w-6"><AvatarFallback>+</AvatarFallback></Avatar></Button></Link>
                </div>
                <div className="space-y-4">
                  {friends.map((fr) => (
                    <Link href="#" key={fr.name}>
                      <div className="flex items-center justify-between hover:bg-muted/50 p-2 rounded transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarFallback>{fr.name.charAt(0)}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium">{fr.name}</p>
                            <p className="text-sm text-muted-foreground">{fr.role}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon"><span className="h-1 w-1 bg-muted-foreground rounded-full"></span></Button>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Events & Study hours */}
              <section className="space-y-4">
                <div className="bg-card p-4 rounded-lg shadow">
                  <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
                  <div className="space-y-4">
                    {upcomingEvents.map((ev) => (
                      <Link href="#" key={ev.title}>
                        <div className="flex items-center gap-3 hover:bg-muted/50 p-2 rounded transition-colors">
                          <div className="p-2 bg-muted rounded"><CalendarIcon className="h-5 w-5" /></div>
                          <div><p className="font-medium">{ev.title} {ev.type}</p><p className="text-sm text-muted-foreground">{ev.date} {ev.time}</p></div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="bg-card p-4 rounded-lg shadow">
                  <h2 className="text-lg font-semibold mb-4">Total Study Hours</h2>
                  <div className="flex items-end gap-2 h-20">
                    {studyHours.map((h, i) => (<div key={i} className="bg-muted w-8 rounded" style={{ height: `${h * 10}px` }}></div>))}
                  </div>
                </div>
              </section>
            </main>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}
