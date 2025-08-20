// app/organisations/layout.tsx
import { Suspense } from "react";

export default function OrganisationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-8">Loading organisations…</div>}>
      {children}
    </Suspense>
  );
}
