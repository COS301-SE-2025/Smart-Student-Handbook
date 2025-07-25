// lib/notes/treeActions.ts
import { FileNode } from "@/types/note";
import { v4 as uuid } from "uuid";

export function addNode(
  tree: FileNode[],
  parentId: string | null,
  type: "note" | "folder"
): FileNode[] {
  const newNode: FileNode = {
    id: uuid(),
    name: type === "note" ? "Untitled Note" : "New Folder",
    type,
  };

  if (!parentId) {
    return [...tree, newNode];
  }

  const clone = structuredClone(tree);

  function insert(nodes: FileNode[]): boolean {
    for (const node of nodes) {
      if (node.id === parentId && node.type === "folder") {
        node.children = node.children || [];
        node.children.push(newNode);
        return true;
      }
      if (node.children && insert(node.children)) return true;
    }
    return false;
  }

  insert(clone);
  return clone;
}

export function deleteNode(tree: FileNode[], id: string): FileNode[] {
  const clone = structuredClone(tree);

  function removeFrom(nodes: FileNode[]): FileNode[] {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        children: node.children ? removeFrom(node.children) : undefined,
      }));
  }

  return removeFrom(clone);
}

export function renameNode(
  tree: FileNode[],
  id: string,
  newName: string
): FileNode[] {
  const clone = structuredClone(tree);

  function rename(nodes: FileNode[]): boolean {
    for (const node of nodes) {
      if (node.id === id) {
        node.name = newName;
        return true;
      }
      if (node.children && rename(node.children)) return true;
    }
    return false;
  }

  rename(clone);
  return clone;
}

export function moveNode(
  tree: FileNode[],
  nodeId: string,
  targetFolderId: string
): FileNode[] {
  if (nodeId === targetFolderId) return tree;

  const clone = structuredClone(tree);
  let movingNode: FileNode | null = null;

  function removeNode(nodes: FileNode[]): FileNode[] {
    return nodes
      .filter((node) => {
        if (node.id === nodeId) {
          movingNode = node;
          return false;
        }
        return true;
      })
      .map((node) => ({
        ...node,
        children: node.children ? removeNode(node.children) : undefined,
      }));
  }

  function insertNode(nodes: FileNode[]): boolean {
    for (const node of nodes) {
      if (node.id === targetFolderId && node.type === "folder") {
        node.children = node.children || [];
        node.children.push(movingNode!);
        return true;
      }
      if (node.children && insertNode(node.children)) return true;
    }
    return false;
  }

  const cleaned = removeNode(clone);
  if (movingNode) {
    insertNode(cleaned);
    return cleaned;
  }

  return tree;
}
