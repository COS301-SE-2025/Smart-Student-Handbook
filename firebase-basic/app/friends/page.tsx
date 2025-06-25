// "use client"

// import { useEffect, useState } from "react"
// import { getAuth } from "firebase/auth"
// import { db } from "@/lib/firebase"
// import { ref, get } from "firebase/database"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Badge } from "@/components/ui/badge"
// import Link from "next/link"
// import { Users, Building2, UserPlus, Plus, Check, X, Clock, Mail } from "lucide-react"
// import AddFriendModal from "@/components/ui/addfriendmodal"

// type UserProfile = {
//   uid: string
//   name: string
//   surname: string
//   profilePicture: string
// }

// export default function FriendsPage() {
//   const [friends, setFriends] = useState<UserProfile[]>([])
//   const [incomingRequests, setIncomingRequests] = useState<UserProfile[]>([])
//   const [sentRequests, setSentRequests] = useState<UserProfile[]>([])
//   const [organizations, setOrganizations] = useState<string[]>([])

//   const auth = getAuth()
//   const user = auth.currentUser

//   useEffect(() => {
//     if (!user) return

//     const fetchData = async () => {
//       const uid = user.uid
//       const userRef = ref(db, `users/${uid}/`)

//       const snapshot = await get(userRef)
//       if (snapshot.exists()) {
//         const data = snapshot.val()
//         const friendIds: string[] = data.friends ? Object.keys(data.friends) : []
//         const incomingIds: string[] = data.incomingRequests ? Object.keys(data.incomingRequests) : []
//         const sentIds: string[] = data.sentRequests ? Object.keys(data.sentRequests) : []
//         const orgs: string[] = data.organizations || []

//         setOrganizations(orgs)
//         await loadUsers(friendIds, setFriends)
//         await loadUsers(incomingIds, setIncomingRequests)
//         await loadUsers(sentIds, setSentRequests)
//       }
//     }

//     const loadUsers = async (ids: string[], setter: (users: UserProfile[]) => void) => {
//       const userProfiles: UserProfile[] = []

//       for (const id of ids) {
//         const snap = await get(ref(db, `users/${id}/UserSettings`))
//         if (snap.exists()) {
//           userProfiles.push({ uid: id, ...snap.val() })
//         }
//       }

//       setter(userProfiles)
//     }

//     fetchData()
//   }, [user])

//   const getInitials = (name: string, surname: string) => {
//     return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase()
//   }

//   return (
//     <div className="p-6 w-full">
//       <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8 w-full min-h-screen">
//         {/* Friends Column */}
//         <Card className="h-fit">
//           <CardHeader className="pb-3 space-y-3">
//             <CardTitle className="flex items-center gap-2 text-lg">
//               <Users className="h-5 w-5 text-blue-600" />
//               Your Friends
//               <Badge variant="secondary" className="ml-auto">
//                 {friends.length}
//               </Badge>
//             </CardTitle>
//             <AddFriendModal />
//           </CardHeader>
//           <CardContent className="space-y-3">
//             {friends.length === 0 ? (
//               <div className="text-center py-8 text-gray-500">
//                 <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
//                 <p className="text-sm">No friends yet</p>
//                 <p className="text-xs text-gray-400">Start connecting with people!</p>
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {friends.map((friend) => (
//                   <Link key={friend.uid} href={`/friends/${friend.uid}`}>
//                     <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100">
//                       <Avatar className="h-10 w-10">
//                         <AvatarImage
//                           src={friend.profilePicture || "/placeholder.svg"}
//                           alt={`${friend.name} ${friend.surname}`}
//                         />
//                         <AvatarFallback className="bg-blue-100 text-blue-600">
//                           {getInitials(friend.name, friend.surname)}
//                         </AvatarFallback>
//                       </Avatar>
//                       <div className="flex-1 min-w-0">
//                         <p className="font-medium text-gray-900 truncate">
//                           {friend.name} {friend.surname}
//                         </p>
//                         <p className="text-sm text-gray-500">Friend</p>
//                       </div>
//                     </div>
//                   </Link>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Organizations Column */}
//         <Card className="h-fit">
//           <CardHeader className="pb-3 space-y-3">
//             <CardTitle className="flex items-center gap-2 text-lg">
//               <Building2 className="h-5 w-5 text-green-600" />
//               Organizations
//               <Badge variant="secondary" className="ml-auto">
//                 {organizations.length}
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-3">
//             <Button className="w-full justify-start bg-blue-500 hover:bg-blue-700 text-white" size="sm">
//               <Plus className="h-4 w-4 mr-2" />
//               Add Organization
//             </Button>

//             {organizations.length === 0 ? (
//               <div className="text-center py-6 text-gray-500">
//                 <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
//                 <p className="text-sm">No organizations</p>
//               </div>
//             ) : (
//               <div className="space-y-2">
//                 {organizations.map((org, i) => (
//                   <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
//                     <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
//                       <Building2 className="h-4 w-4 text-green-600" />
//                     </div>
//                     <span className="font-medium text-green-800">{org}</span>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Friend Requests Column */}
//         <Card className="h-fit">
//           <CardHeader className="pb-3">
//             <CardTitle className="flex items-center gap-2 text-lg">
//               <Mail className="h-5 w-5 text-orange-600" />
//               Friend Requests
//               <Badge variant="secondary" className="ml-auto">
//                 {incomingRequests.length + sentRequests.length}
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             {/* Incoming Requests */}
//             <div>
//               <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                 <Mail className="h-4 w-4" />
//                 Incoming ({incomingRequests.length})
//               </h3>
//               {incomingRequests.length === 0 ? (
//                 <p className="text-sm text-gray-500 py-2">No incoming requests</p>
//               ) : (
//                 <div className="space-y-2">
//                   {incomingRequests.map((req) => (
//                     <div key={req.uid} className="p-3 rounded-lg border border-orange-100 bg-orange-50">
//                       <div className="flex items-center gap-3 mb-2">
//                         <Avatar className="h-8 w-8">
//                           <AvatarImage
//                             src={req.profilePicture || "/placeholder.svg"}
//                             alt={`${req.name} ${req.surname}`}
//                           />
//                           <AvatarFallback className="bg-orange-100 text-orange-600 text-xs">
//                             {getInitials(req.name, req.surname)}
//                           </AvatarFallback>
//                         </Avatar>
//                         <div className="flex-1 min-w-0">
//                           <p className="font-medium text-gray-900 text-sm truncate">
//                             {req.name} {req.surname}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="flex gap-2">
//                         <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
//                           <Check className="h-3 w-3 mr-1" />
//                           Accept
//                         </Button>
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
//                         >
//                           <X className="h-3 w-3 mr-1" />
//                           Reject
//                         </Button>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Sent Requests */}
//             <div>
//               <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                 <Clock className="h-4 w-4" />
//                 Sent ({sentRequests.length})
//               </h3>
//               {sentRequests.length === 0 ? (
//                 <p className="text-sm text-gray-500 py-2">No sent requests</p>
//               ) : (
//                 <div className="space-y-2">
//                   {sentRequests.map((req) => (
//                     <div key={req.uid} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
//                       <div className="flex items-center gap-3 mb-2">
//                         <Avatar className="h-8 w-8">
//                           <AvatarImage
//                             src={req.profilePicture || "/placeholder.svg"}
//                             alt={`${req.name} ${req.surname}`}
//                           />
//                           <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
//                             {getInitials(req.name, req.surname)}
//                           </AvatarFallback>
//                         </Avatar>
//                         <div className="flex-1 min-w-0">
//                           <p className="font-medium text-gray-900 text-sm truncate">
//                             {req.name} {req.surname}
//                           </p>
//                           <p className="text-xs text-gray-500">Pending...</p>
//                         </div>
//                       </div>
//                       <Button
//                         size="sm"
//                         variant="outline"
//                         className="w-full text-red-600 border-red-200 hover:bg-red-50"
//                       >
//                         <X className="h-3 w-3 mr-1" />
//                         Cancel Request
//                       </Button>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {incomingRequests.length === 0 && sentRequests.length === 0 && (
//               <div className="text-center py-6 text-gray-500">
//                 <Mail className="h-10 w-10 mx-auto mb-2 text-gray-300" />
//                 <p className="text-sm">No friend requests</p>
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }



// friends/page.tsx



///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////



// "use client";

// import { useEffect, useState } from "react";
// import { getAuth } from "firebase/auth";
// import { db } from "@/lib/firebase";
// import { ref, get, onValue, remove } from "firebase/database";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { Badge } from "@/components/ui/badge";
// import Link from "next/link";
// import { Users, UserPlus, Check, X, Clock, Mail, UserX } from "lucide-react";
// import AddFriendModal from "@/components/ui/addfriendmodal";

// interface UserProfile {
//   uid: string;
//   name: string;
//   surname: string;
//   profilePicture: string;
// }

// export default function FriendsPage() {
//   const [friends, setFriends] = useState<UserProfile[]>([]);
//   const [incomingRequests, setIncomingRequests] = useState<UserProfile[]>([]);
//   const [sentRequests, setSentRequests] = useState<UserProfile[]>([]);

//   const auth = getAuth();
//   const user = auth.currentUser;

//   useEffect(() => {
//     if (!user) return;

//     const uid = user.uid;
//     const userRef = ref(db, `users/${uid}`);

//     const unsubscribe = onValue(userRef, async (snapshot) => {
//       const data = snapshot.val();
//       const friendIds = data?.friends ? Object.keys(data.friends) : [];
//       const incomingIds = data?.incomingRequests ? Object.keys(data.incomingRequests) : [];
//       const sentIds = data?.sentRequests ? Object.keys(data.sentRequests) : [];

//       await loadUsers(friendIds, setFriends);
//       await loadUsers(incomingIds, setIncomingRequests);
//       await loadUsers(sentIds, setSentRequests);
//     });

//     return () => unsubscribe();
//   }, [user]);

//   const loadUsers = async (ids: string[], setter: (users: UserProfile[]) => void) => {
//     const userProfiles: UserProfile[] = [];

//     for (const id of ids) {
//       const snap = await get(ref(db, `users/${id}/UserSettings`));
//       if (snap.exists()) {
//         userProfiles.push({ uid: id, ...snap.val() });
//       }
//     }

//     setter(userProfiles);
//   };

//   const cancelFriendship = async (friendId: string) => {
//     if (!user) return;
//     await remove(ref(db, `users/${user.uid}/friends/${friendId}`));
//     await remove(ref(db, `users/${friendId}/friends/${user.uid}`));
//   };

//   const getInitials = (name: string, surname: string) => {
//     return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase();
//   };

//   return (
//     <div className="p-6 w-full">
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full min-h-screen">
//         {/* Friends Column */}
//         <Card className="h-fit">
//           <CardHeader className="pb-3 space-y-3">
//             <CardTitle className="flex items-center gap-2 text-lg">
//               <Users className="h-5 w-5 text-blue-600" />
//               Your Friends
//               <Badge variant="secondary" className="ml-auto">
//                 {friends.length}
//               </Badge>
//             </CardTitle>
//             <AddFriendModal />
//           </CardHeader>
//           <CardContent className="space-y-3">
//             {friends.length === 0 ? (
//               <div className="text-center py-8 text-gray-500">
//                 <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
//                 <p className="text-sm">No friends yet</p>
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {friends.map((friend) => (
//                   <div key={friend.uid} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100">
//                     <Link href={`/friends/${friend.uid}`} className="flex-1 flex items-center gap-3">
//                       <Avatar className="h-10 w-10">
//                         <AvatarImage
//                           src={friend.profilePicture || "/placeholder.svg"}
//                           alt={`${friend.name} ${friend.surname}`}
//                         />
//                         <AvatarFallback className="bg-blue-100 text-blue-600">
//                           {getInitials(friend.name, friend.surname)}
//                         </AvatarFallback>
//                       </Avatar>
//                       <div className="flex-1 min-w-0">
//                         <p className="font-medium text-gray-900 truncate">
//                           {friend.name} {friend.surname}
//                         </p>
//                         <p className="text-sm text-gray-500">Friend</p>
//                       </div>
//                     </Link>
//                     <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelFriendship(friend.uid)}>
//                       <UserX className="h-4 w-4 mr-1" />
//                       Remove
//                     </Button>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Friend Requests Column */}
//         <Card className="h-fit">
//           <CardHeader className="pb-3">
//             <CardTitle className="flex items-center gap-2 text-lg">
//               <Mail className="h-5 w-5 text-orange-600" />
//               Friend Requests
//               <Badge variant="secondary" className="ml-auto">
//                 {incomingRequests.length + sentRequests.length}
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div>
//               <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                 <Mail className="h-4 w-4" /> Incoming ({incomingRequests.length})
//               </h3>
//               {incomingRequests.map((req) => (
//                 <Link key={req.uid} href={`/friends/${req.uid}`}>
//                   <div className="p-3 rounded-lg border border-orange-100 bg-orange-50 hover:bg-orange-100 cursor-pointer">
//                     <div className="flex items-center gap-3 mb-2">
//                       <Avatar className="h-8 w-8">
//                         <AvatarImage src={req.profilePicture || "/placeholder.svg"} alt={req.name} />
//                         <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
//                       </Avatar>
//                       <p className="font-medium">{req.name} {req.surname}</p>
//                     </div>
//                   </div>
//                 </Link>
//               ))}
//             </div>

//             <div>
//               <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
//                 <Clock className="h-4 w-4" /> Sent ({sentRequests.length})
//               </h3>
//               {sentRequests.map((req) => (
//                 <Link key={req.uid} href={`/friends/${req.uid}`}>
//                   <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer">
//                     <div className="flex items-center gap-3 mb-2">
//                       <Avatar className="h-8 w-8">
//                         <AvatarImage src={req.profilePicture || "/placeholder.svg"} alt={req.name} />
//                         <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
//                       </Avatar>
//                       <p className="font-medium">{req.name} {req.surname}</p>
//                     </div>
//                   </div>
//                 </Link>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }



///////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////


// Updated friends/page.tsx
"use client"

import { useEffect, useState } from "react"
import { getAuth } from "firebase/auth"
import { db } from "@/lib/firebase"
import { ref, get, onValue, remove, set } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Users, Mail, Check, X, Clock } from "lucide-react"
import AddFriendModal from "@/components/ui/addfriendmodal"

type UserProfile = {
  uid: string
  name: string
  surname: string
  profilePicture: string
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<UserProfile[]>([])
  const [sentRequests, setSentRequests] = useState<UserProfile[]>([])
  const auth = getAuth()
  const user = auth.currentUser

  useEffect(() => {
    if (!user) return
    const uid = user.uid
    const userRef = ref(db, `users/${uid}`)

    const unsubscribe = onValue(userRef, async (snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.val()

      const friendIds = Object.keys(data.friends || {})
      const incomingIds = Object.keys(data.incomingRequests || {})
      const sentIds = Object.keys(data.sentRequests || {})

      await loadUsers(friendIds, setFriends)
      await loadUsers(incomingIds, setIncomingRequests)
      await loadUsers(sentIds, setSentRequests)
    })

    return () => unsubscribe()
  }, [user])

  const loadUsers = async (ids: string[], setter: (users: UserProfile[]) => void) => {
    const profiles: UserProfile[] = []
    for (const id of ids) {
      const snap = await get(ref(db, `users/${id}/UserSettings`))
      if (snap.exists()) profiles.push({ uid: id, ...snap.val() })
    }
    setter(profiles)
  }

  const handleAccept = async (uid: string) => {
    if (!user) return
    await set(ref(db, `users/${user.uid}/friends/${uid}`), true)
    await set(ref(db, `users/${uid}/friends/${user.uid}`), true)
    await remove(ref(db, `users/${user.uid}/incomingRequests/${uid}`))
    await remove(ref(db, `users/${uid}/sentRequests/${user.uid}`))
  }

  const handleReject = async (uid: string) => {
    if (!user) return
    await remove(ref(db, `users/${user.uid}/incomingRequests/${uid}`))
    await remove(ref(db, `users/${uid}/sentRequests/${user.uid}`))
  }

  const handleCancel = async (uid: string) => {
    if (!user) return
    await remove(ref(db, `users/${user.uid}/sentRequests/${uid}`))
    await remove(ref(db, `users/${uid}/incomingRequests/${user.uid}`))
  }

  const getInitials = (name: string, surname: string) => `${name[0]}${surname[0]}`.toUpperCase()

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
      {/* Friends Column */}
      <Card className="h-fit">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-blue-600" />
            Your Friends
            <Badge variant="secondary" className="ml-auto">{friends.length}</Badge>
          </CardTitle>
          <AddFriendModal />
        </CardHeader>
        <CardContent className="space-y-3">
          {friends.map((friend) => (
            <Link key={friend.uid} href={`/friends/${friend.uid}`}>
              <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={friend.profilePicture || "/placeholder.svg"} />
                  <AvatarFallback>{getInitials(friend.name, friend.surname)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{friend.name} {friend.surname}</p>
                  <p className="text-sm text-gray-500">Friend</p>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Friend Requests */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-orange-600" />
            Friend Requests
            <Badge variant="secondary" className="ml-auto">{incomingRequests.length + sentRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Incoming ({incomingRequests.length})</h3>
            {incomingRequests.map((req) => (
              <div key={req.uid} className="flex items-center justify-between bg-orange-50 border p-3 rounded">
                <Link href={`/friends/${req.uid}`} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
                  </Avatar>
                  <span>{req.name} {req.surname}</span>
                </Link>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => handleAccept(req.uid)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(req.uid)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Sent ({sentRequests.length})</h3>
            {sentRequests.map((req) => (
              <div key={req.uid} className="flex items-center justify-between border p-3 rounded bg-gray-50">
                <Link href={`/friends/${req.uid}`} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
                  </Avatar>
                  <span>{req.name} {req.surname}</span>
                </Link>
                <Button size="sm" variant="outline" onClick={() => handleCancel(req.uid)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
