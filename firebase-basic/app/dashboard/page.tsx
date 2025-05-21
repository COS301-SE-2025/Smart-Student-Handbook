'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

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
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome!</h1>
      <p>You are logged in as <strong>{userEmail}</strong></p>
              {userData ? (
          <>
            <p><strong>Name:</strong> {userData.title}</p>
            <p><strong>Role:</strong> {userData.note}</p>
          </>
        ) : (
          <p className="text-gray-500 mt-4">No user data found.</p>
        )}
    </main>
  );
}