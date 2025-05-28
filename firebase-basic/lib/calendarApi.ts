import { auth } from "./firebase";

// Helper to get current user token
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return await user.getIdToken();
}

export const calendarApi = {
  async getLectures(semesterId: string) {
    const token = await getIdToken();
    const res = await fetch(`/api/lectures?semesterId=${semesterId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch lectures");
    return await res.json();
  },
  async addLecture(lecture: any, semesterId: string) {
    const token = await getIdToken();
    const res = await fetch("/api/lectures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ semesterId, lecture }),
    });
    if (!res.ok) throw new Error("Failed to add lecture");
    return await res.json();
  },
  async deleteLecture(lectureId: string) {
    const token = await getIdToken();
    const res = await fetch("/api/lectures", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lectureId }),
    });
    if (!res.ok) throw new Error("Failed to delete lecture");
    return await res.json();
  },

  // Events
  async getEvents(semesterId: string) {
    const token = await getIdToken();
    const res = await fetch(`/api/events?semesterId=${semesterId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch events");
    return await res.json();
  },
  async addEvent(event: any, semesterId: string) {
    const token = await getIdToken();
    const res = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ semesterId, event }),
    });
    if (!res.ok) throw new Error("Failed to add event");
    return await res.json();
  },
  async deleteEvent(eventId: string) {
    const token = await getIdToken();
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ eventId }),
    });
    if (!res.ok) throw new Error("Failed to delete event");
    return await res.json();
  },
};
