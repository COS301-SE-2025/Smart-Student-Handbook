"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils"; 

type Props = {
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

export function SmartLoader({ label, fullScreen, className }: Props) {
  return (
    <div
      className={cn(
        fullScreen
          ? "min-h-[40vh] grid place-content-center"
          : "p-6",
        "text-muted-foreground"
      )}
    >
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        {label ? <span className="text-sm">{label}</span> : null}
      </div>
    </div>
  );
}
