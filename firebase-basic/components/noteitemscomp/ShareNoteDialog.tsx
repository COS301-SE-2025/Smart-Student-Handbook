"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserIcon } from "lucide-react";
import { useState } from "react";

interface User {
  uid: string;
  name?: string;
  surname?: string;
}

interface ShareNoteDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  onShare: (collaboratorId: string, permission: "read" | "write") => void;
  searchUsers: (query: string) => Promise<User[]>;
}

export default function ShareNoteDialog({
  open,
  setOpen,
  onShare,
  searchUsers,
}: ShareNoteDialogProps) {
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [permission, setPermission] = useState<"read" | "write">("read");

  const handleSearch = async () => {
    const results = await searchUsers(searchName);
    setSearchResults(results);
  };

  const handleConfirm = () => {
    if (collaboratorId) {
      onShare(collaboratorId, permission);
      setOpen(false);
      setSearchResults([]);
      setSearchName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Note</DialogTitle>
        </DialogHeader>

        <Label>Search by name</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="Enter name or surname"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border rounded p-2">
            {searchResults.map((user) => (
              <Button
                key={user.uid}
                variant="ghost"
                size="sm"
                className="w-full flex items-center justify-start gap-2"
                onClick={() => {
                  setCollaboratorId(user.uid);
                  setSearchName(`${user.name ?? ""} ${user.surname ?? ""}`);
                  setSearchResults([]);
                }}
              >
                <UserIcon className="h-4 w-4" />
                <span>{user.name ?? "Unnamed"} {user.surname ?? ""}</span>
              </Button>
            ))}
          </div>
        )}

        <Label className="mt-4">Permissions</Label>
        <RadioGroup
          value={permission}
          onValueChange={(value) => setPermission(value as "read" | "write")}
          className="flex space-x-4 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="read" id="read" />
            <Label htmlFor="read">Read</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="write" id="write" />
            <Label htmlFor="write">Write</Label>
          </div>
        </RadioGroup>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
