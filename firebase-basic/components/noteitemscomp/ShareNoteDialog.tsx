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
import { UserIcon, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import { toast } from "sonner";

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
    noteId: string;
}

export default function ShareNoteDialog({
    open,
    noteId,
    setOpen,
    onShare,
    searchUsers,
}: ShareNoteDialogProps) {
    const [searchName, setSearchName] = useState("");
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
    const [permission, setPermission] = useState<"read" | "write" | "none">("none"); 

    // Debounced search effect
    useEffect(() => {
        if (!searchName.trim()) {
            setSearchResults([]);
            return;
        }

        const delay = setTimeout(async () => {
            try {
                const results = await searchUsers(searchName);
                setSearchResults(results);
            } catch (err) {
                console.error("Search error:", err);
            }
        }, 50);

        return () => clearTimeout(delay);
    }, [searchName, searchUsers]);

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!noteId || !collaboratorId || permission === "none") {
            toast.error("Missing note, collaborator, or permission");
            return;
        }

        try {
            const functions = getFunctions(app);
            const shareNote = httpsCallable(functions, "shareNote");

            const result = await shareNote({ collaboratorId, noteId, permission });

            toast.success("Note shared successfully!");
            setOpen(false);
            setCollaboratorId(null);
            setSearchName("");
            setSearchResults([]);
            console.log(`Shared note ${noteId} with ${collaboratorId}`, result);
        } catch (error: any) {
            console.error("Error sharing note:", error);
            toast.error("Failed to share note.");
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
                </div>

                {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                        {searchResults.map((user) => {
                            const isSelected = collaboratorId === user.uid;
                            return (
                                <Button
                                    key={user.uid}
                                    variant={isSelected ? "secondary" : "ghost"}
                                    size="sm"
                                    className="w-full flex items-center justify-between gap-2"
                                    onClick={() => {
                                        setCollaboratorId(user.uid);
                                        setSearchName(`${user.name ?? ""} ${user.surname ?? ""}`);
                                        setSearchResults([]);
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4" />
                                        <span>{user.name ?? "Unnamed"} {user.surname ?? ""}</span>
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 text-green-500" />}
                                </Button>
                            );
                        })}
                    </div>
                )}

                <Label className="mt-4">Permissions</Label>
                <RadioGroup
                    value={permission}
                    onValueChange={(value) => setPermission(value as "read" | "write" | "none")}
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
                    <Button onClick={handleShare}>Share</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
