import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function BackboardBadge({ className }: Props) {
  return (
    <a
      href="https://backboard.io"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border-2 border-bb-steel/25 bg-white/80 px-3 py-1.5 shadow-sm transition-all duration-300 hover:border-bb-blue/35 hover:bg-bb-blue/5 hover:shadow-md active:scale-[0.97] dark:border-bb-steelDark dark:bg-bb-phantom/60 dark:hover:bg-bb-phantom",
        className,
      )}
      aria-label="Built on Backboard.io"
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-bb-blue/10 ring-1 ring-bb-blue/20 transition-transform duration-300 group-hover:scale-105 group-hover:bg-bb-blue/15 dark:bg-bb-blue/20 dark:ring-bb-blue/30"
        aria-hidden
      >
        <Image
          src="/backboard.png"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
        />
      </span>
      <span className="text-[11px] font-medium tracking-tight text-bb-steel/80 transition-colors duration-200 group-hover:text-bb-blue dark:text-bb-phantomLight/70 dark:group-hover:text-bb-phantomLight">
        Built on{" "}
        <span className="text-bb-phantom transition-colors duration-200 group-hover:text-bb-blue dark:text-bb-phantomLight">
          Backboard.io
        </span>
      </span>
    </a>
  );
}
