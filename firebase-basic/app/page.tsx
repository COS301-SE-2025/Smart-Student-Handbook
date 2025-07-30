"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, Zap, Cloud } from "lucide-react"
import * as React from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

const teamMembers = [
  {
    name: "Reinhard Pretorius",
    role: "AI Developer",
    image: "/rein.jpg",
    description: `A third-year Computer Science student with a passion for AI and ML. Expertise in intelligent systems and data pipelines.`,
    skills: ["AI/ML", "Python", "Data Science"],
  },
  {
    name: "Tanaka Ndhlovu",
    role: "Web Developer",
    image: "/tanaka.jpg",
    description: `Third-year Information and Knowledge Systems student skilled in React, Vue, Angular, and UI/UX design for cross-platform apps.`,
    skills: ["React", "Vue", "UI/UX"],
  },
  {
    name: "Takudzwa Magunda",
    role: "Integration & Service Engineer",
    image: "/taku.jpg",
    description: `Experienced in Java, Python, Node.js, and TypeScript. Specializes in API integration and cloud service orchestration.`,
    skills: ["Java", "Node.js", "Cloud Services"],
  },
  {
    name: "Mpumelelo Njamela",
    role: "Testing Engineer",
    image: "/mpume.jpg",
    description: `Strong foundation in algorithms, data structures, and systems architecture. Applies predictive sports analytics and ML techniques.`,
    skills: ["Testing", "Algorithms", "Analytics"],
  },
  {
    name: "Oscar Motsepe",
    role: "Front-End Developer",
    image: "/junior.jpg",
    description: `Creative developer proficient in HTML5, React, and Figma. Focused on modern responsive UI and interactive visualizations.`,
    skills: ["React", "Figma", "UI Design"],
  },
]

const features = [
  {
    icon: BookOpen,
    title: "Smart Organization",
    description: "Organize notes by Degree, Module, and Year with AI-powered categorization",
  },
  {
    icon: Zap,
    title: "AI-Powered Features",
    description: "Intelligent flashcard generation and smart recommendations for enhanced learning",
  },
  {
    icon: Cloud,
    title: "Cloud-Based Access",
    description: "Access your notes anywhere, anytime with seamless cloud synchronization",
  },
  {
    icon: Users,
    title: "Collaborative Learning",
    description: "Share and collaborate on notes with classmates and study groups",
  },
]

export default function Home() {
  const router = useRouter()
  const [isLoginLoading, setIsLoginLoading] = React.useState(false)
  const [isSignupLoading, setIsSignupLoading] = React.useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Image */}
      <section className="w-full">
        <div className="relative w-full h-[600px] md:h-[600px]">
          <Image
            src="/sshbbanner.png"
            alt="Smart Student Handbook Banner"
            fill
            className="object-cover"
            priority
          />
        </div>
      </section>

      {/* Hero Section */}
      <section className="bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                Welcome to Your
                <span className="block text-gray-400">Learning Journey</span>
              </h1>
              <p className="max-w-3xl mx-auto text-xl md:text-2xl text-gray-700 leading-relaxed">
                A cutting-edge AI-driven note-taking platform designed to help students organize, collaborate, and
                enhance their learning with smart recommendations and cloud-based accessibility.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800 px-8 py-3 text-lg font-semibold transition-all duration-200 disabled:opacity-70"
                disabled={isLoginLoading}
                onClick={() => {
                  setIsLoginLoading(true)
                  router.push("/login")
                }}
              >
                {isLoginLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span></span>
                  </div>
                ) : (
                  "Login"
                )}
              </Button>

              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800 px-8 py-3 text-lg font-semibold transition-all duration-200 disabled:opacity-70"
                disabled={isSignupLoading}
                onClick={() => {
                  setIsSignupLoading(true)
                  router.push("/signup")
                }}
              >
                {isSignupLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span></span>
                  </div>
                ) : (
                  "Sign Up"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Smart Student Handbook?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of note-taking with our AI-powered platform designed specifically for students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Overview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Project Overview</h2>
          <p className="text-lg text-gray-600 mb-8">Revolutionizing student learning through intelligent technology</p>
          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
            <p>
              Team F5 presents the Smart Student Handbook, an innovative AI-powered, cloud-based platform that
              transforms how students organize and interact with their academic materials. Our solution features
              structured note organization by Degree, Module, and Year, enhanced with rich text editing capabilities,
              seamless multimedia integration, and intelligent flashcard generation to optimize your learning
              experience.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Meet Team F5</h2>
            <p className="text-xl text-gray-600">The talented individuals behind Smart Student Handbook</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="text-center bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <Image
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    fill
                    className="rounded-full object-cover border-4 border-blue-100"
                  />
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                  <p className="text-blue-600 font-semibold">{member.role}</p>
                </div>

                <p className="text-gray-600 text-sm leading-relaxed mb-4">{member.description}</p>

                <div className="flex flex-wrap gap-2 justify-center">
                  {member.skills.map((skill, skillIndex) => (
                    <Badge key={skillIndex} variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to Transform Your Learning?</h2>
          <p className="text-gray-700">
            Join thousands of students already using Smart Student Handbook to enhance their academic journey.
          </p>
          
            <Button 
              size="lg" 
              className="bg-black text-white hover:bg-gray-800 px-8 py-3 text-lg font-semibold"
              onClick={() => window.open("/user-manual.pdf", "_blank")} 
            >
              User Manual
            </Button>
          
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4">
            <h3 className="text-2xl text-gray-700 font-bold">Smart Student Handbook</h3>
            <p className="text-gray-400">Empowering students with intelligent learning solutions</p>
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-500">© {new Date().getFullYear()} Team F5. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
