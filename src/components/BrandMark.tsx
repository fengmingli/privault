import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary", className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Z" />
        <circle cx="12" cy="10.5" r="2" />
        <path d="M12 12.5v3" />
      </svg>
    </div>
  );
}
