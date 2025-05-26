"use client";

import Image from "next/image";
import Link from 'next/link';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const teamMembers = [
  {
    name: 'Reinhard Pretorius',
    role: 'AI Developer',
    image: '/images/Reinhard.jpg',
    description: `A third-year Computer Science student with a passion for AI and ML. Expertise in intelligent systems and data pipelines.`
  },
  {
    name: 'Tanaka Ndhlovu',
    role: 'Web Developer',
    image: '/images/Tanaka.jpg',
    description: `Third-year Information and Knowledge Systems student skilled in React, Vue, Angular, and UI/UX design for cross-platform apps.`
  },
  {
    name: 'Takudzwa Magunda',
    role: 'Integration & Service Engineer',
    image: '/images/Takudzwa.jpg',
    description: `Experienced in Java, Python, Node.js, and TypeScript. Specializes in API integration and cloud service orchestration.`
  },
  {
    name: 'Mpumelelo Njamela',
    role: 'Testing Engineer',
    image: '/images/Mpumelelo.jpg',
    description: `Strong foundation in algorithms, data structures, and systems architecture. Applies predictive sports analytics and ML techniques.`
  },
  {
    name: 'Oscar Motsepe',
    role: 'Front-End Developer',
    image: '/images/Oscar.jpg',
    description: `Creative developer proficient in HTML5, React, and Figma. Focused on modern responsive UI and interactive visualizations.`
  }
];


export default function Home() {
  const [expanded, setExpanded] = useState<string | null>(null);

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
        <div className="p-4">
          <p>
            Team F5 presents the Smart Student Handbook, an AI-powered, cloud-based platform
            for structured note organization by Degree, Module, and Year. Enjoy rich text
            editing, multimedia integration, and intelligent flashcard generation.
          </p>
        </div>
      </Card>

      {/* Team Section with Clickable Cards */}
      <section className="w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-center mb-4">Meet the Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => {
            const isOpen = expanded === member.name;
            return (
              <Card
                key={member.name}
                onClick={() => setExpanded(isOpen ? null : member.name)}
                className="cursor-pointer transition-shadow hover:shadow-lg"
              >
                <CardHeader>
                  <CardTitle>{member.name}</CardTitle>
                  <CardDescription>{member.role}</CardDescription>
                </CardHeader>
                {isOpen && (
                  <div className="p-4 flex flex-col items-center">
                    <div className="w-24 h-24 relative mb-4">
                    <Image src={member.image} alt={member.name} fill className="rounded-full object-contain bg-white"/>
                    </div>
                    <p className="text-center">{member.description}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Team F5. All rights reserved.
      </footer>
    </div>
  );
}
