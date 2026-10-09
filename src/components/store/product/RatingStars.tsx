import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RatingStarsProps {
  /** 0-5, fractions allowed. */
  value: number;
  /** Pixel-free size token. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Accessible text for the whole control; when omitted the stars are decorative. */
  label?: string;
}

const sizes = { sm: "size-3.5", md: "size-4.5", lg: "size-6" } as const;

/** Five stars with fractional fill. Decorative unless `label` is given. */
export function RatingStars({ value, size = "sm", className, label }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className={cn("relative inline-block", sizes[size])}>
            <Star className={cn("absolute inset-0 text-border-strong", sizes[size])} strokeWidth={1.75} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-accent text-accent", sizes[size])} strokeWidth={1.75} aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}
