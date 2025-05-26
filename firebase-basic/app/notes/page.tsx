'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth, fs, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/app-sidebar"
import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarRadioGroup,
    MenubarRadioItem,
    MenubarSeparator,
    MenubarShortcut,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { get, onValue, ref } from 'firebase/database';

export default function DashboardPage() {
    const [notesTree, setNotesTree] = useState({});
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [notesAvailable, setNotesAvailable] = useState(false);

    useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.warn("User not authenticated.");
            setNotesLoaded(true);
            setNotesAvailable(false);
            return;
        }

        const notesRef = ref(db, `${user.uid}/Notes`);

        const timeout = setTimeout(() => {
            if (!notesLoaded) {
                console.warn("Notes loading timed out.");
                setNotesLoaded(true);
                setNotesAvailable(false);
            }
        }, 5000);

        onValue(
            notesRef,
            (snapshot) => {
                clearTimeout(timeout);
                const raw = snapshot.val();
                if (raw) {
                    console.log("Notes loaded:", raw);
                    setNotesTree(raw);
                    setNotesAvailable(true);
                } else {
                    console.warn("No notes found.");
                    setNotesAvailable(false);
                }
                setNotesLoaded(true);
            },
            { onlyOnce: true }
        );
    });

    return () => {
        unsubscribe(); // cleanup auth listener
    };
}, []);


    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarTrigger />

            <main className="flex mx-auto w-full max-w-5xl p-6 gap-6 h-screen">
                <div className="flex flex-col w-2/3 h-full">
                    <div className="h-content">
                        <Menubar>
                            <MenubarMenu>
                                <MenubarTrigger>Notes</MenubarTrigger>
                                <MenubarContent>
                                    <MenubarItem>
                                        New Notes <MenubarShortcut>⌘N</MenubarShortcut>
                                    </MenubarItem>
                                    <MenubarItem>
                                        New Window <MenubarShortcut>⌘W</MenubarShortcut>
                                    </MenubarItem>
                                    <MenubarSeparator />
                                    <MenubarSub>
                                        <MenubarSubTrigger>Share</MenubarSubTrigger>
                                        <MenubarSubContent>
                                            <MenubarItem>Email link</MenubarItem>
                                            <MenubarItem>Messages</MenubarItem>
                                            <MenubarItem>Notes</MenubarItem>
                                        </MenubarSubContent>
                                    </MenubarSub>
                                    <MenubarSeparator />
                                    <MenubarItem>
                                        Print... <MenubarShortcut>⌘P</MenubarShortcut>
                                    </MenubarItem>
                                </MenubarContent>
                            </MenubarMenu>
                            <MenubarMenu>
                                <MenubarTrigger>Edit</MenubarTrigger>
                                <MenubarContent>
                                    <MenubarItem>
                                        Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                                    </MenubarItem>
                                    <MenubarItem>
                                        Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                                    </MenubarItem>
                                    <MenubarSeparator />
                                    <MenubarSub>
                                        <MenubarSubTrigger>Find</MenubarSubTrigger>
                                        <MenubarSubContent>
                                            <MenubarItem>Search the web</MenubarItem>
                                            <MenubarSeparator />
                                            <MenubarItem>Find...</MenubarItem>
                                            <MenubarItem>Find Next</MenubarItem>
                                            <MenubarItem>Find Previous</MenubarItem>
                                        </MenubarSubContent>
                                    </MenubarSub>
                                    <MenubarSeparator />
                                    <MenubarItem>Cut</MenubarItem>
                                    <MenubarItem>Copy</MenubarItem>
                                    <MenubarItem>Paste</MenubarItem>
                                </MenubarContent>
                            </MenubarMenu>
                            <MenubarMenu>
                                <MenubarTrigger disabled={!notesAvailable}>View</MenubarTrigger>
                                {notesAvailable && (
                                    <MenubarContent>
                                        {typeof notesTree === "object" &&
                                            Object.entries(notesTree).map(([degree, topics]) => (
                                                <MenubarSub key={degree}>
                                                    <MenubarSubTrigger>{degree}</MenubarSubTrigger>
                                                    <MenubarSubContent>
                                                        {typeof topics === "object" &&
                                                            Object.entries(topics).map(([topic, years]) => (
                                                                <MenubarSub key={topic}>
                                                                    <MenubarSubTrigger>{topic}</MenubarSubTrigger>
                                                                    <MenubarSubContent>
                                                                        {typeof years === "object" && years && 
                                                                            Object.entries(years).map(([year, tags]) => (
                                                                                <MenubarSub key={year}>
                                                                                    <MenubarSubTrigger>{year}</MenubarSubTrigger>
                                                                                    <MenubarSubContent>
                                                                                        {typeof tags === "object" &&
                                                                                            Object.entries(tags).map(([tag, noteData]) => (
                                                                                                <MenubarItem
                                                                                                    key={tag}
                                                                                                    onClick={() => {
                                                                                                        if (
                                                                                                            noteData &&
                                                                                                            typeof noteData === "object" &&
                                                                                                            "content" in noteData
                                                                                                        ) {
                                                                                                            const content = (noteData as { content?: string }).content;
                                                                                                            alert(content || "No content");
                                                                                                        } else {
                                                                                                            alert("Invalid note data");
                                                                                                        }
                                                                                                    }}
                                                                                                >
                                                                                                    {tag}
                                                                                                </MenubarItem>
                                                                                            ))}
                                                                                    </MenubarSubContent>
                                                                                </MenubarSub>
                                                                            ))}
                                                                    </MenubarSubContent>
                                                                </MenubarSub>
                                                            ))}
                                                    </MenubarSubContent>
                                                </MenubarSub>
                                            ))}
                                    </MenubarContent>
                                )}
                            </MenubarMenu>


                        </Menubar>

                    </div>
                    <div className="bg-blue-300 flex-grow mt-4">
                        Bottom Div
                    </div>
                </div>

                <div className="w-1/3 bg-green-300 h-full">
                    Right Div
                </div>
            </main>




        </SidebarProvider>

    );
}