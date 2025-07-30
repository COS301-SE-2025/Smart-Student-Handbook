"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { get, ref } from "@firebase/database";
import { db } from "@/lib";
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import { permission } from "process";
import { getAuth } from "firebase/auth";

interface Collaborator {
    uid: string;
    name?: string;
    surname?: string;
    permission: "read" | "write";
}

interface ViewCollaboratorsDialogProps {
    open: boolean;
    setOpen: (value: boolean) => void;
    collaborators: Collaborator[];
    onRemove: (uid: string) => void;
    noteId: string;
}

export default function ViewCollaboratorsDialog({
    open,
    setOpen,
    noteId,
}: ViewCollaboratorsDialogProps) {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

    useEffect(() => {
        const fetchCollaborators = async () => {
            const userID = getAuth().currentUser?.uid;
            const snap = await get(ref(db, `users/${userID}/notes/${noteId}/collaborators`));

            if (snap.exists()) {
                const data = snap.val();
                const list: Collaborator[] = [];

                for (const uid in data) {
                    const entry = data[uid];
                    if (entry?.placeholder === false) continue;
                    list.push({ uid: uid, permission: entry });
                }

                setCollaborators(list);
            } else {
                setCollaborators([]);
            }
        };

        if (open) fetchCollaborators();
    }, [noteId, open]);

    const handleRemove = async (userId: string) => {
        console.log(`Mock remove user ${userId} from note ${noteId}`);
        setCollaborators((prev: any[]) => prev.filter((c: { id: string; }) => c.id !== userId));
    };


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Collaborators</DialogTitle>
                </DialogHeader>

                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto border rounded p-2">
                    {collaborators.length != 0}
                    (
                    {collaborators.map((user:
                        {
                            uid: string;
                            name: string | null;
                            surname: string : null ;
                    permission : string | null ; 
                    }) => (
                    <div
                        key={user.uid}
                        className="flex items-center justify-between text-sm p-1 border rounded hover:bg-muted"
                    >
                        <div>
                            <span className="font-medium">
                                {user.name} {user.surname}
                            </span>{" "}
                            —{" "}
                            <span className="text-muted-foreground text-xs">
                                {user.permission}
                            </span>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleRemove(user.uid)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>


                    ))}): (
                    <p className="text-sm text-muted-foreground">No collaborators found.</p>


                    )
                </div>
            </DialogContent>
        </Dialog>
    );
}
