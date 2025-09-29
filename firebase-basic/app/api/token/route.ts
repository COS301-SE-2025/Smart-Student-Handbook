// app/api/token/route.ts
"use server"
import { DocumentManager } from "@y-sweet/sdk";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const docID = searchParams.get("doc");
    const token = await manager.getOrCreateDocAndToken(docID!);
    return Response.json(token);
}

const manager = new DocumentManager(
    process.env.CONNECTION_STRING || "ys://127.0.0.1:8080"
);

export async function getClientToken(docID: string) {
    return await manager.getOrCreateDocAndToken(docID);
}

export async function saveDocumentToDB(roomName: string, data: string) {

}

export async function loadDocumentFromDB(roomName: string) {

    return "Initial content here...";
}
