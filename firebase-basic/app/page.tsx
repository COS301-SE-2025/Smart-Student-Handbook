"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, Zap, Cloud } from "lucide-react"
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Banner Image */}
      <section className="w-full">
        <div className="relative w-full h-[350px] md:h-[500px]">
          <Image src="/banner.jpeg" alt="Smart Student Handbook Banner" fill className="object-contain" priority />
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-amber-700 to-orange-800 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                Welcome to Your
                <span className="block text-amber-200">Learning Journey</span>
              </h1>
              <p className="max-w-3xl mx-auto text-xl md:text-2xl text-amber-100 leading-relaxed">
                A cutting-edge AI-driven note-taking platform designed to help students organize, collaborate, and
                enhance their learning with smart recommendations and cloud-based accessibility.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-white text-amber-700 hover:bg-amber-50 px-8 py-3 text-lg font-semibold transition-all duration-200 disabled:opacity-70"
                disabled={isLoginLoading}
                onClick={() => {
                  setIsLoginLoading(true)
                  router.push("/login")
                }}
              >
                {isLoginLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Redirecting...</span>
                  </div>
                ) : (
                  "Login"
                )}
              </Button>

              <Button
                size="lg"
                className="bg-white text-amber-700 hover:bg-amber-50 px-8 py-3 text-lg font-semibold transition-all duration-200 disabled:opacity-70"
                disabled={isSignupLoading}
                onClick={() => {
                  setIsSignupLoading(true)
                  router.push("/signup")
                }}
              >
                {isSignupLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Redirecting...</span>
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
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Smart Student Handbook?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of note-taking with our AI-powered platform designed specifically for students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <CardContent className="pt-8 pb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                    <feature.icon className="w-8 h-8 text-amber-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Project Overview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-3xl font-bold text-gray-900">Project Overview</CardTitle>
              <CardDescription className="text-lg text-gray-600 mt-4">
                Revolutionizing student learning through intelligent technology
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                <p className="text-center">
                  Team F5 presents the Smart Student Handbook, an innovative AI-powered, cloud-based platform that
                  transforms how students organize and interact with their academic materials. Our solution features
                  structured note organization by Degree, Module, and Year, enhanced with rich text editing
                  capabilities, seamless multimedia integration, and intelligent flashcard generation to optimize your
                  learning experience.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Meet Team F5</h2>
            <p className="text-xl text-gray-600">The talented individuals behind Smart Student Handbook</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <Card
                key={index}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="relative w-24 h-24 mx-auto">
                      <Image
                        src={member.image || "/placeholder.svg"}
                        alt={member.name}
                        fill
                        className="rounded-full object-cover border-4 border-amber-100"
                      />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                      <p className="text-amber-600 font-semibold">{member.role}</p>
                    </div>

                    <p className="text-gray-600 text-sm leading-relaxed">{member.description}</p>

                    <div className="flex flex-wrap gap-2 justify-center">
                      {member.skills.map((skill, skillIndex) => (
                        <Badge
                          key={skillIndex}
                          variant="secondary"
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-amber-700 to-orange-800 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to Transform Your Learning?</h2>
          <p className="text-amber-100">
            Join thousands of students already using Smart Student Handbook to enhance their academic journey.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-amber-700 hover:bg-amber-50 px-8 py-3 text-lg font-semibold">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4">
            <h3 className="text-2xl font-bold">Smart Student Handbook</h3>
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
