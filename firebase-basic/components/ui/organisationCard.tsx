"use client";

import { Button } from "@/components/ui/button";
import { joinOrganisation } from "@/lib/organisations";
import { auth } from "@/lib/firebase";
import { useState } from "react";
import Link from "next/link";

interface OrganisationCardProps {
  id: string;
  name: string;
  description: string;
  isMember?: boolean;
  isOwner?: boolean;
  showJoinButton?: boolean;
}

export default function OrganisationCard({ 
  id, 
  name, 
  description, 
  isMember = false, 
  isOwner = false,
  showJoinButton = true
}: OrganisationCardProps) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("You must be signed in to join");
      
      await joinOrganisation(id, userId);
      // Instead of reloading the whole page, just update the UI
      setJoining(false);
      // Mark as member
      isMember = true;
      // Show success message
      setError("Successfully joined! Refresh to see changes");
    } catch (err: any) {
      setError(err.message || "Failed to join organisation");
      setJoining(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <Link href={`/organisations/${id}`} className="flex-1">
          <h2 className="text-lg font-semibold hover:underline">{name}</h2>
          <p className="text-gray-600 mt-2">{description}</p>
        </Link>
        
        {showJoinButton && !isMember && !isOwner && (
          <Button 
            size="sm" 
            onClick={handleJoin}
            disabled={joining}
            className="ml-4"
          >
            {joining ? "Joining..." : "Join"}
          </Button>
        )}
      </div>
      
      {isOwner && (
        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
          Owner
        </span>
      )}
      
      {isMember && !isOwner && (
        <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
          Member
        </span>
      )}
      
      {error && (
        <p className={`text-xs mt-2 ${error.includes("Success") ? "text-green-500" : "text-red-500"}`}>
          {error}
        </p>
      )}
    </div>
  );
}