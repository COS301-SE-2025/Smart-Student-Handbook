"use server";

import { DocumentManager } from "@y-sweet/sdk";

const manager = new DocumentManager(
  process.env.CONNECTION_STRING || "ys://127.0.0.1:8080"
);

export async function getClientToken(docID: string) {
  return await manager.getOrCreateDocAndToken(docID);
}

export async function saveDocumentToDB(roomName: string, data: string) {
  console.log(`Saving doc for room: ${roomName}`);
}

export async function loadDocumentFromDB(roomName: string) {
  console.log(`Loading doc for room: ${roomName}`);
  return "Initial content here...";
}
