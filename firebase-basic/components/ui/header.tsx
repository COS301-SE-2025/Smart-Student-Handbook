import { Search, Bell } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background">
      {/* Left side: Logo + Search */}
      <div className="flex items-center gap-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src="/smart-student.png" alt="Smart Student" />
          <AvatarFallback>SS</AvatarFallback>
        </Avatar>

        <div className="w-[320px] relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes, modules, flashcards..."
            className="pl-8"
          />
        </div>
      </div>

      {/* Right side: Notification + User Avatar */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <Avatar className="h-8 w-8">
          <AvatarImage src="/default-user.png" alt="User" />
          <AvatarFallback>JM</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}