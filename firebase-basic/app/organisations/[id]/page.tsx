"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
// import { getOrganisation, joinOrganisation } from "@/lib/organisations";
import { auth } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";

export default function OrganisationDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null;
  
  const [org, setOrg] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Organisation ID is missing");
      setLoading(false);
      return;
    }

    const loadOrg = async () => {
      try {
        const orgData = await getOrganisation(id);
        setOrg(orgData);
        
        const userId = auth.currentUser?.uid;
        if (userId) {
          setIsMember(orgData.members.includes(userId));
        }
      } catch (err) {
        setError("Failed to load organisation details");
        console.error("Error loading organisation:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrg();
  }, [id]);

  const handleJoin = async () => {
    if (!id) {
      setError("Organisation ID is missing");
      return;
    }
    
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("Not authenticated");

      await joinOrganisation(id, userId);
      setIsMember(true);
    } catch (err) {
      setError("Failed to join organisation");
      console.error("Error joining organisation:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseOrganisations = () => {
    router.push("/organisations");
  };

  if (loading) return <p className="p-6">Loading organisation details...</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;
  if (!org) return <p className="p-6">Organisation not found</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{org.name}</h1>
        </div>
        
        <Button 
          variant="outline" 
          onClick={handleBrowseOrganisations}
        >
          Browse All Organisations
        </Button>
      </div>
      
      <p className="text-gray-700 mb-8">{org.description}</p>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Members: {org.members.length}
        </h2>
      </div>

      <div className="border-t pt-6">
        {!isMember && (
          <div className="text-center py-8 border rounded-lg bg-gray-50">
            <h3 className="text-xl font-semibold mb-3">Join this Organisation</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Become a member to collaborate with other members
            </p>
            <Button 
              size="lg" 
              onClick={handleJoin} 
              disabled={loading}
              className="px-8"
            >
              {loading ? "Joining..." : "Join Organisation"}
            </Button>
          </div>
        )}

        {isMember && (
          <div className="text-center py-8 border rounded-lg bg-green-50">
            <div className="flex justify-center mb-3">
              <div className="bg-green-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">You're a member</h3>
            <p className="text-gray-600 mb-4">
              You can now collaborate with other members
            </p>
            <Button 
              variant="outline" 
              onClick={handleBrowseOrganisations}
              className="mt-2"
            >
              Browse Other Organisations
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}