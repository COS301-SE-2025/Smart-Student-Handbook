// src/hooks/useUserId.ts
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

// This hook returns the userId and a loading boolean
export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsub = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { userId, loading };
}
