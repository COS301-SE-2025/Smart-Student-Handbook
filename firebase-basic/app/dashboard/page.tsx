'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/app-sidebar"
import { addDoc, collection } from 'firebase/firestore';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Label } from '@radix-ui/react-label';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userData, setUserData] = useState<{ note?: string; title?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);

        const userDocRef = doc(db, 'users', user.uid);
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarTrigger />

      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <Carousel>
          <CarouselContent>
            <CarouselItem>
              <Label>Testing Label</Label>

            </CarouselItem>
            <CarouselItem>Note 2</CarouselItem>
            <CarouselItem>Note 3</CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        <form>
          <div>
            {/* Add fields here later if you want user input */}
          </div>
          <Button type="submit">Click Me</Button>
        </form>



      </main>
    </SidebarProvider>

  );
}