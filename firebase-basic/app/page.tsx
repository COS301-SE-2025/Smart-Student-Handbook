import Image from "next/image";
import { Button } from "@/components/ui/button"
import Link from 'next/link';

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">

        <h1>Welcome to My App</h1>
        <Link href="/login">
          <Button variant="outline">Go to Login</Button>
        </Link>

        <Link href="/signup">
          <Button variant="outline">Register</Button>
        </Link>

      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
