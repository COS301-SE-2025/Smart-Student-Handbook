import Image from "next/image";
import styles from "./page.module.css";
import { Button } from "@/components/ui/button"


export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>

        <h1>Welcome to My App</h1>
        <Link href="/login">
          <Button variant="outline">Go to Login</Button>
        </Link>

      </main>
      <footer className={styles.footer}>
      </footer>
    </div>
  );
}
