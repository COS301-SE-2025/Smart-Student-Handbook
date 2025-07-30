"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";

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
}

export default function ViewCollaboratorsDialog({
    open,
    setOpen,
    collaborators,
}: ViewCollaboratorsDialogProps) {
    function onRemove(uid: string): void {
        console.log("Removing Collaborator") ; 
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Collaborators</DialogTitle>
                </DialogHeader>

                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto border rounded p-2">
                    {collaborators.map((user) => (
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
