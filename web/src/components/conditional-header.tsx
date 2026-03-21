"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { getStoredToken, getMe, type UserInfo } from "@/lib/api";

export function ConditionalHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    getMe(token).then(setUser).catch(() => setUser(null));
  }, []);

  if (pathname === "/") return null;
  return <Header user={user} />;
}
