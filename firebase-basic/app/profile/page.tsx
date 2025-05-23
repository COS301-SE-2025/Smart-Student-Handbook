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
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu"
import React from 'react';

export default function ProfilePage() {
    return (

        <SidebarProvider>
            <AppSidebar />
            <SidebarTrigger />
            <main className="flex gap-4 p-4">
                <div className="p-4 w-2/3">
                    <Tabs defaultValue="account" className="w-[400px]">
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
                                            <div className="flex flex-col space-y-1.5">
                                                <Label htmlFor="Description">Description</Label>
                                                <Textarea />
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
                </div>
                <div className="p-4 w-1/3">
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
                                <div className="flex items-center justify-between p-2 border rounded-lg shadow-sm bg-white m-1 dark:bg-gray-900 dark:text-white">
                                    <div className="flex items-center space-x-3">
                                        <Button variant="link" className="text-base">
                                            <UserIcon className="w-4 h-4 mr-1" /> Friend1
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
                                                <DropdownMenuItem>
                                                    View Profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Message
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Report
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Remove Friend
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                </div>

                                <div className="flex items-center justify-between p-2 border rounded-lg shadow-sm bg-white m-1 dark:bg-gray-900 dark:text-white">
                                    <div className="flex items-center space-x-3">
                                        <Button variant="link" className="text-base">
                                            <UserIcon className="w-4 h-4 mr-1" /> Friend2
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
                                                <DropdownMenuItem>
                                                    View Profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Message
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Report
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    Remove Friend
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </main>

        </SidebarProvider >

    );
}