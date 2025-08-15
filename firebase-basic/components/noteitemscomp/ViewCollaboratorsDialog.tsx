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
import path from "path";
import { toast } from "sonner";
import { getFunctions, httpsCallable } from "firebase/functions";

interface Collaborator {
    uid: string;
    name?: string;
    surname?: string;
    permission: "read" | "write";
}

interface ViewCollaboratorsDialogProps {
    open: boolean;
    setOpen: (value: boolean) => void;
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
            const path = `users/${userID}/notes/${noteId}/collaborators`;
            const snap = await get(ref(db, path));

            if (snap.exists()) {
                const data = snap.val();
                const list: Collaborator[] = [];

                for (const uid in data) {
                    const entry = data[uid];

                    if (!entry || entry.placeholder === false) continue;

                    let permission = typeof entry === "string" ? entry : entry.permission;

                    const settingsSnap = await get(ref(db, `users/${uid}/UserSettings`));
                    const settings = settingsSnap.exists() ? settingsSnap.val() : {};

                    list.push({
                        uid,
                        permission,
                        name: settings.name ?? "",
                        surname: settings.surname ?? "",
                    });
                }

                setCollaborators(list);
            } else {
                setCollaborators([]);
            }
        };

        if (open) fetchCollaborators();
    }, [noteId, open]);


    const handleRemove = async (user: Collaborator) => {
        try {
            const functions = getFunctions();
            const removeCollaborator = httpsCallable(functions, "removeCollaborator");

            await removeCollaborator({
                noteId,
                collaboratorId: user.uid,
            });

            toast.success(`Removed collaborator ${user.name || user.uid}`);

            setCollaborators((prev) =>
                prev.filter((c) => c.uid !== user.uid)
            );
        } catch (err) {
            console.error("Error removing collaborator:", err);
            toast.error("Failed to remove collaborator");
        }
    };


    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>Collaborators</DialogTitle>
                    </DialogHeader>

                    <div className="mt-2 space-y-1 max-h-60 overflow-y-auto border rounded p-2">
                        {collaborators.length !== 0 ? (
                            collaborators.map((user) => (
                                <div
                                    key={user.uid}
                                    className="flex items-center justify-between text-sm p-1 border rounded hover:bg-muted"
                                >
                                    <div>
                                        <span className="font-medium">
                                            {user.name ?? ""} {user.surname ?? ""}
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
                                        onClick={() => handleRemove(user)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No collaborators found.</p>
                        )}
                    </div>

                </DialogContent>
            </Dialog>
        </>
    );
}
