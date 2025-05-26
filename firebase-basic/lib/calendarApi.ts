// lib/calendarApi.ts

import { getAuth } from "firebase/auth";


const USER_ID = "dev1"; // Replace with real user auth/userId when ready
const auth = getAuth() ; 
const user = auth.currentUser ;

export const calendarApi = {
  // LECTURES
  async getLectures(semesterId: string) {
    const res = await fetch(`/api/lectures?userId=${USER_ID}&semesterId=${semesterId}`);
    if (!res.ok) throw new Error("Failed to fetch lectures");
    return await res.json();
  },
  async addLecture(lecture: any, semesterId: string) {
    const res = await fetch("/api/lectures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, semesterId, lecture }),
    });
    if (!res.ok) throw new Error("Failed to add lecture");
    return await res.json();
  },
  async deleteLecture(lectureId: string) {
    const res = await fetch("/api/lectures", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, lectureId }),
    });
    if (!res.ok) throw new Error("Failed to delete lecture");
    return await res.json();
  },

  // EVENTS
  async getEvents(semesterId: string) {
    const res = await fetch(`/api/events?userId=${USER_ID}&semesterId=${semesterId}`);
    if (!res.ok) throw new Error("Failed to fetch events");
    return await res.json();
  },
  async addEvent(event: any, semesterId: string) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, semesterId, event }),
    });
    if (!res.ok) throw new Error("Failed to add event");
    return await res.json();
  },
  async deleteEvent(eventId: string) {
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, eventId }),
    });
    if (!res.ok) throw new Error("Failed to delete event");
    return await res.json();
  },
};
