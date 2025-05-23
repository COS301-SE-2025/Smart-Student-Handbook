'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"


export default function ProfilePage() {
    return (

        <SidebarProvider>

            <AppSidebar />
            <SidebarTrigger />

            <main >
                <Tabs defaultValue="account" className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="password">Password</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Details</CardTitle>
                                <CardDescription>
                                    <div className="flex flex-col space-y-1.5">
                                        <Input id="name" placeholder="Description for the Profile" />
                                    </div></CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form>
                                    <div className="grid w-full items-center gap-4">
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="name">Name</Label>
                                            <Input id="name" placeholder="Name" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="name">Surname</Label>
                                            <Input id="name" placeholder="Surname" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="name">Degree</Label>
                                            <Input id="name" placeholder="Degree" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="name">Occupation</Label>
                                            <Input id="name" placeholder="Occupation" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="name">Hobbies</Label>
                                            <Input id="name" placeholder="Hobbies" />
                                        </div>
                                    </div>
                                </form>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button>Save</Button>
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

                <Card className="w-[350px]">
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

                <div className="classthree">This is a Main Testing site for Profile Creation</div>
            </main>

        </SidebarProvider >

    );
}