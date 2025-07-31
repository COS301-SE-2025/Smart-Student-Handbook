// types/note.ts
export type FileNode = {
  id: string
  name: string
  type: "folder" | "note"
  parentId?: string | null
  children?: FileNode[]
  
}

export type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: "note";
  collaborators: {
    [userId: string]: string;
  };
  parentId : string ; 
};

export type Folder = {
  id: string;
  name: string;
  type: "folder";
  expanded: boolean;
  children: FileNode[];
  collaborators: {
    [userId: string]: string;
  };
  parentId: string ; 
};

export type User = {
  uid: string;
  name?: string;
  surname?: string;
};
