// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">
          Sorry, we couldn’t find what you were looking for.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-md px-4 py-2 border bg-primary text-primary-foreground"
          >
            Go home
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center rounded-md px-4 py-2 border"
          >
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
