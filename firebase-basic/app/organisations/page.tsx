"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { fs, auth } from "@/lib/firebase";
import OrganisationCard from "@/components/ui/organisationCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuthState } from "react-firebase-hooks/auth";

interface Organisation {
  id: string;
  name: string;
  description: string;
  members: string[];
  ownerId: string;
}

export default function OrganisationListPage() {
  const [user] = useAuthState(auth);
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const snapshot = await getDocs(collection(fs, "organisations"));
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Organisation[];
        setOrgs(list);
      } catch (err) {
        setError("Failed to load organisations");
        console.error("Firestore error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadOrgs();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Organisations</h1>
        <Link href="/organisations/new">
          <Button>Create New</Button>
        </Link>
      </div>
      
      {loading && <p>Loading organisations...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {orgs.map(org => {
          const isMember = user ? org.members.includes(user.uid) : false;
          const isOwner = user ? org.ownerId === user.uid : false;
          
          return (
            <OrganisationCard
              key={org.id}
              id={org.id}
              name={org.name}
              description={org.description}
              isMember={isMember}
              isOwner={isOwner}
              showJoinButton={true}
            />
          );
        })}
      </div>
    </div>
  );
}