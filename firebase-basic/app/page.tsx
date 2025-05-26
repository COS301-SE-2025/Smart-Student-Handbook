import Image from "next/image";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen p-8 gap-8 bg-gray-50">
      {/* Header Section */}
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Smart Student Handbook</h1>
        <p className="max-w-2xl text-lg text-gray-700">
          A cutting-edge AI-driven note-taking platform designed to help students organize,
          collaborate, and enhance their learning with smart recommendations and cloud-based accessibility.
        </p>
      </header>

      {/* Navigation Buttons */}
      <nav className="flex space-x-4">
        <Link href="/login">
          <Button variant="outline">Login</Button>
        </Link>
        <Link href="/signup">
          <Button>Sign Up</Button>
        </Link>
      </nav>

      {/* Project Info Card */}
      <Card className="max-w-3xl w-full">
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Team F5 presents the Smart Student Handbook, an AI-powered, cloud-based platform
            for structured note organization by Degree, Module, and Year. Enjoy rich text
            editing, multimedia integration, and intelligent flashcard generation.
          </p>
        </CardContent>
      </Card>

      {/* Team Section */}
      <section className="w-full max-w-4xl space-y-4">
        <h2 className="text-2xl font-semibold text-center">Meet the Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Reinhard Pretorius</CardTitle>
              <CardDescription>AI Developer</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tanaka Ndhlovu</CardTitle>
              <CardDescription>Web Developer</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Takudzwa Magunda</CardTitle>
              <CardDescription>Integration & Service Engineer</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mpumelelo Njamela</CardTitle>
              <CardDescription>Testing Engineer</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Oscar Motsepe</CardTitle>
              <CardDescription>Front-End Developer</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Team F5. All rights reserved.
      </footer>
    </div>
  );
}