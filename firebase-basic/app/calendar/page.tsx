"use client";

import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import StudentCalendar from "@/components/ui/student-calendar";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { ref } from "firebase/database";
import { useState } from "react";

export default function Home() {
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    degree: "",
    events: "",
    daily: "",
    semester: ""

  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarTrigger />
      <div className="w-full max-w-[1440px] mx-auto space-y-8 px-4 lg:px-8 py-6 dark:bg-gray-900 dark:text-white">
        <StudentCalendar />
      </div>
    </SidebarProvider>

  );
}
