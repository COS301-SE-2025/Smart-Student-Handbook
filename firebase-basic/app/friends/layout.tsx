import { Suspense } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-8">Loading friends…</div>}>{children}</Suspense>;
}
