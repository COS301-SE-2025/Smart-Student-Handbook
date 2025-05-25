'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, fs, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/app-sidebar"
import { sendTestNote } from "@/utils/TestFirebaseButton";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Label } from '@radix-ui/react-label';
import { Button } from '@/components/ui/button';
import { addFriend } from "@/utils/SaveFriends";

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

    const handleAdd = async () => {
      const friendID = prompt("Enter friend's User ID:");
      if (friendID) {
        await addFriend(friendID.trim());
      }
    };


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

        <div>
          <Button onClick={sendTestNote}>
            Send Test Note to Firebase
          </Button>
        </div>

        <div>
          <Button onClick={handleAdd}>
            Add Friend
          </Button>
        </div>

      </main>
    </SidebarProvider>

  );
}