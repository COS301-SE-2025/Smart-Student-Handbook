// app/organisations/loading.tsx
"use client"   // only if you need client hooks; otherwise you can omit

export default function OrganisationsLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      <p className="ml-3 text-sm text-muted-foreground">Loading organisations…</p>
    </div>
  )
}
