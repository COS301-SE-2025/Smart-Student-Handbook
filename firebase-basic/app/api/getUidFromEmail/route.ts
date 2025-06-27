import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return new Response(JSON.stringify({ error: "Missing email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user = await getAuth().getUserByEmail(email);
    return new Response(JSON.stringify({ uid: user.uid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
