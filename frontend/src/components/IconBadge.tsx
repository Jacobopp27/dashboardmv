import type { ReactNode } from "react";

type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray";

const BG: Record<Tone, string> = {
  red:    "bg-soft-red",
  orange: "bg-soft-orange",
  yellow: "bg-soft-yellow",
  green:  "bg-soft-green",
  blue:   "bg-soft-blue",
  gray:   "bg-soft-gray",
};
const FG: Record<Tone, string> = {
  red:    "text-icon-red",
  orange: "text-icon-orange",
  yellow: "text-icon-yellow",
  green:  "text-icon-green",
  blue:   "text-icon-blue",
  gray:   "text-icon-gray",
};

interface Props {
  tone: Tone;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function IconBadge({ tone, children, size = "md" }: Props) {
  const sz = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  return (
    <div className={`${sz} ${BG[tone]} ${FG[tone]} rounded-full flex items-center justify-center shrink-0`}>
      {children}
    </div>
  );
}
