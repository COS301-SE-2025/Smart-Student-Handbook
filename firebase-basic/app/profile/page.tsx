'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { saveUserSettings } from "@/utils/SaveUserSettings";
import { Badge } from "@/components/ui/badge"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/app-sidebar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { MessageSquareIcon, MoreVertical, OptionIcon, UserIcon, XIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu"
import React, { useEffect, useState } from 'react';
import { ProfileAreaChart } from "@/components/ui/area-chart"
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import { get, onValue, ref } from "firebase/database";

export default function ProfilePage() {
    const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        degree: "",
        occupation: "",
        hobbies: "",
        description: "",
        organizations: ""
    });

    useEffect(() => {
        const auth = getAuth();

        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            console.log("Auth state changed, user:", user);
            if (!user) {
                setFriends([]);
                return;
            }

            const userID = user.uid;
            console.log("Fetching friends for userID:", userID);

            const friendsRef = ref(db, `${userID}/Friends`);

            onValue(friendsRef, async (snapshot) => {
                const friendsData = snapshot.val();
                console.log("onValue triggered, friendsData:", friendsData);
                if (!friendsData) {
                    setFriends([]);
                    return;
                }

                const friendIDs = Object.entries(friendsData)
                    .filter(([_, val]) => val === true)
                    .map(([id]) => id);

                console.log("Filtered friendIDs:", friendIDs);

                const friendsList: { id: string; name: string }[] = [];

                await Promise.all(
                    friendIDs.map(async (fid) => {
                        const nameRef = ref(db, `${fid}/UserSettings/name`);
                        const nameSnap = await get(nameRef);
                        const friendName = nameSnap.exists() ? nameSnap.val() : "Unknown";
                        console.log(`Fetched friend name for ${fid}:`, friendName);
                        friendsList.push({ id: fid, name: friendName });
                    })
                );

                console.log("Final friendsList:", friendsList);
                setFriends(friendsList);
            });
        });

        return () => unsubscribe();
    }, []);


    useEffect(() => {
        const auth = getAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                console.warn("User not logged in");
                return;
            }

            const userID = user.uid;
            const settingsRef = ref(db, `${userID}/UserSettings`);

            onValue(settingsRef, (snapshot) => {
                const data = snapshot.val();
                console.log("Fetched user settings:", data);

                if (data) {
                    setFormData({
                        name: data.name || "",
                        surname: data.surname || "",
                        degree: data.degree || "",
                        occupation: data.occupation || "",
                        hobbies: Array.isArray(data.hobbies) ? data.hobbies.join(", ") : data.hobbies || "",
                        description: data.description || "",
                        organizations: Array.isArray(data.organizations) ? data.organizations.join(", ") : data.organizations || ""
                    });
                }
            });
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSave = async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            alert("User not logged in");
            return;
        }

        const userID = user.uid;
        const formattedData = {
            ...formData,
            hobbies: formData.hobbies.split(",").map((h: string) => h.trim()),
            organizations: formData.organizations.split(",").map((o: string) => o.trim())
        };

        await saveUserSettings(userID, formattedData);
        alert("Profile saved!");
    };

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarTrigger />
            <div className="flex flex-col flex-1">
                <main className="mx-auto w-full max-w-5xl flex gap-6 p-6 items-start">
                    <div className="flex-1">
                        <Tabs defaultValue="account" className="w-full max-w-xl">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="account">Account</TabsTrigger>
                                <TabsTrigger value="password">Password</TabsTrigger>
                            </TabsList>
                            <TabsContent value="account">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Profile Details</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid w-full items-center gap-4">
                                            {[
                                                { id: "name", label: "Name" },
                                                { id: "surname", label: "Surname" },
                                                { id: "degree", label: "Degree" },
                                                { id: "occupation", label: "Occupation" },
                                                { id: "hobbies", label: "Hobbies (comma-separated)" },
                                                { id: "organizations", label: "Organizations (comma-separated)" }
                                            ].map(({ id, label }) => (
                                                <div className="flex flex-col space-y-1.5" key={id}>
                                                    <Label htmlFor={id}>{label}</Label>
                                                    <Input id={id} value={formData[id as keyof typeof formData]} onChange={handleChange} />
                                                </div>
                                            ))}
                                            <div className="flex flex-col space-y-1.5">
                                                <Label htmlFor="description">Description</Label>
                                                <Textarea id="description" value={formData.description} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <Button onClick={handleSave}>Save</Button>
                                    </CardFooter>
                                </Card>

                            </TabsContent>
                            <TabsContent value="password">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Password</CardTitle>
                                        <CardDescription>Change your password here</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="current">Current password</Label>
                                            <Input id="current" type="password" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="new">New password</Label>
                                            <Input id="new" type="password" />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button>Save password</Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <div className="p-4">
                        <Card className="w-[350px] m-1">
                            <CardHeader>
                                <CardTitle>Organizations</CardTitle>
                                <CardDescription>List of all the organizations</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form>
                                    <div className="flex gap-4">
                                        <Avatar>
                                            <AvatarImage src="https://www.up.ac.za/themes/up2.0/images/vertical-logo-bg.png" />
                                            <AvatarFallback>UNI</AvatarFallback>
                                        </Avatar>

                                        <Avatar>
                                            <AvatarImage src="https://github.com/shadcn.png" />
                                            <AvatarFallback>CN</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </form>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline">Remove</Button>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">Edit Organization</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle>Edit Organization</DialogTitle>
                                            <DialogDescription>
                                                Add an Organization
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="name" className="text-right">
                                                    Name
                                                </Label>
                                                <Input id="name" className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="username" className="text-right">
                                                    URL
                                                </Label>
                                                <Input id="url" className="col-span-3" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit">Save changes</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardFooter>
                        </Card>

                        <Card className="w-[350px] m-1">
                            <CardHeader>
                                <CardTitle>Badges</CardTitle>
                                <CardDescription>Here you can see all your badges and Achievements</CardDescription>

                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Badge variant="outline">Best Achiever</Badge>
                                    <Badge variant="outline">Slacker</Badge>
                                    <Badge variant="outline">Lazy</Badge>
                                    <Badge variant="outline">Fast Coder</Badge>
                                    <Badge variant="outline">Researcher</Badge>
                                    <Badge variant="outline">GitHub Enthusiast</Badge>


                                </div>
                            </CardContent>
                        </Card>
                        <Card className="w-[350px] m-1">
                            <CardHeader>
                                <CardTitle>Friends List</CardTitle>
                                <CardDescription>
                                    List of all your friends or your emptiness
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    {friends.length === 0 ? (
                                        <p>No friends found</p>
                                    ) : (
                                        friends.map(({ id, name }) => (
                                            <div
                                                key={id}
                                                className="flex items-center justify-between p-2 border rounded-lg shadow-sm bg-white m-1 dark:bg-gray-900 dark:text-white"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <Button variant="link" className="text-base">
                                                        <UserIcon className="w-4 h-4 mr-1" /> {name}
                                                    </Button>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Button size="icon" variant="ghost">
                                                        <MessageSquareIcon className="w-4 h-4" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="icon">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="w-56">
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                                                            <DropdownMenuItem>Message</DropdownMenuItem>
                                                            <DropdownMenuItem>Report</DropdownMenuItem>
                                                            <DropdownMenuItem>Remove Friend</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>

                <div className="w-full flex justify-center mt-10">
                    <div className="w-full max-w-4xl">
                        <ProfileAreaChart />
                    </div>
                </div>
            </div>
        </SidebarProvider >

    );
}