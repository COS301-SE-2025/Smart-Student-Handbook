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
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useEffect } from "react";

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
            const snap = await get(ref(db, `notes/${noteId}/collaborators`));

            if (snap.exists()) {
                const data = snap.val();
                const list: Collaborator[] = [];

                for (const uid in data) {
                    const entry = data[uid];
                    if (entry?.placeholder === false) continue; // skip placeholder
                    list.push({ id: uid, permission: entry });
                }

                setCollaborators(list);
            } else {
                setCollaborators([]);
            }
        };

        if (open) fetchCollaborators();
    }, [noteId, open]);

    // 🔧 Mock removal function
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
                    {collaborators.map((user: { uid: Key | null | undefined; name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; surname: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; permission: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }) => (
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
                                onClick={() => onRemove(user.uid)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
