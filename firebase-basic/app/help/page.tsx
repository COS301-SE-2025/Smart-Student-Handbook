"use client"

import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Video, HelpCircle } from "lucide-react"

export default function HelpMenuPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Help Menu"
        description="Quick links to user manual, tutorials, and FAQs."
      />

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* User Guide */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                User Manual
              </CardTitle>
              <CardDescription>
                Read the full Smart Student Handbook PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="full">
                <Link
                  href="/Smart Student Handbook User Manual.pdf"
                  target="_blank"
                  rel="noopener"
                >
                  Open PDF
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Tutorials */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Tutorials
              </CardTitle>
              <CardDescription>
                Watch step‑by‑step video guides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="full">
                <Link href="/tutorials">View Tutorials</Link>
              </Button>
            </CardContent>
          </Card>

          {/* FAQs */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                FAQs
              </CardTitle>
              <CardDescription>
                Find answers to common questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="full">
                <Link href="/faqs">Browse FAQs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
