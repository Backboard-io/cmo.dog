"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <Card className="relative overflow-hidden border border-bb-steel/60 dark:border-bb-steelDark/80 bg-white/90 dark:bg-bb-steelDark/90 shadow-[0_20px_70px_rgba(17,24,39,0.18)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
            aria-hidden
            style={{
              background:
                "radial-gradient(1100px 420px at 5% -10%, rgba(248,113,113,0.2), transparent 60%), radial-gradient(900px 360px at 95% 20%, rgba(0,123,252,0.16), transparent 55%)",
            }}
          />
          <CardHeader className="relative gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-200">
              Error 500
            </span>
            <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
              Someone spilled the coffee.
            </CardTitle>
            <CardDescription className="text-base text-gray-600 dark:text-gray-300">
              Onni is cleaning up the mess. Let&apos;s try that again or head somewhere safe.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div className="space-y-4">
              <div className="rounded-xl border border-bb-steel/60 bg-bb-cloud/70 p-4 text-sm text-bb-phantom shadow-sm dark:border-bb-steelDark/80 dark:bg-bb-phantom/40 dark:text-bb-phantomLight">
                Quick recovery moves:
                <ul className="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 rounded-full bg-red-400" aria-hidden />
                    Retry the last action once the page resets.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 rounded-full bg-red-400" aria-hidden />
                    Head home and start a new run fresh.
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => reset()} className="shadow-md">
                  Try again
                </Button>
                <Link
                  href="/"
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "shadow-sm")}
                >
                  Back to home
                </Link>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 rounded-[32px] bg-red-200/40 blur-2xl dark:bg-red-500/20" aria-hidden />
                <Image
                  src="/sad_onni.png"
                  alt="Onni looking apologetic"
                  width={320}
                  height={320}
                  priority
                  className="relative rounded-[28px] border border-bb-steel/60 bg-white/80 p-3 shadow-lg transition-transform duration-300 ease-out hover:-translate-y-1 dark:border-bb-steelDark/80 dark:bg-bb-steelDark"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="relative justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>We&apos;ll keep the run history safe while this resets.</span>
            {error.digest ? (
              <span className="font-mono uppercase tracking-[0.2em]">Digest {error.digest}</span>
            ) : (
              <span className="font-mono uppercase tracking-[0.2em]">Recovering</span>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
