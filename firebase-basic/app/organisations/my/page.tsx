"use client";

import { useEffect, useState } from "react";
import { getUserOrganisations } from "@/lib/organisations";
import { auth } from "@/lib/firebase";
import OrganisationCard from "@/components/ui/organisationCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuthState } from "react-firebase-hooks/auth";

export default function MyOrganisationsPage() {
  const [user] = useAuthState(auth);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrgs = async () => {
      try {
        if (!user) {
          setError("Please sign in to view your organisations");
          setLoading(false);
          return;
        }
        
        const userOrgs = await getUserOrganisations(user.uid);
        setOrgs(userOrgs);
      } catch (err) {
        setError("Failed to load your organisations");
        console.error("Error loading organisations:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadOrgs();
  }, [user]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Organisations</h1>
        <div className="space-x-2">
          <Link href="/organisations">
            <Button variant="outline">Browse All</Button>
          </Link>
          <Link href="/organisations/new">
            <Button>Create New</Button>
          </Link>
        </div>
      </div>

      {loading && <p>Loading your organisations...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!loading && !error && orgs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">You haven't joined any organisations yet</p>
          <Link href="/organisations">
            <Button>Browse Organisations</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {orgs.map((org) => {
            const isOwner = user ? org.ownerId === user.uid : false;
            
            return (
              <OrganisationCard
                key={org.id}
                id={org.id}
                name={org.name}
                description={org.description}
                isMember={true}
                isOwner={isOwner}
                showJoinButton={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}