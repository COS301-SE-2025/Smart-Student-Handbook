export type Role = "admin" | "editor" | "viewer";

export interface Member {
  userId: string;
  role: Role;
  displayName: string;
}

export interface Organisation {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  members: Member[];
  notes: any[]; // Consider creating a Note type if needed
}