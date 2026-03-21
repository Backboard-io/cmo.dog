"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, listUsers, patchUser, type AdminUser } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planColor(plan: string) {
  if (plan === "pro") return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function providerIcon(provider: string) {
  if (provider === "google") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Google" className="inline-block">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    );
  }
  return <span className="text-[10px] text-gray-400 font-mono">email</span>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium border
        ${type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
      `}
      style={{ animation: "toastIn 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {type === "success" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 8l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      )}
      {msg}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ users }: { users: AdminUser[] }) {
  const total = users.length;
  const paid = users.filter((u) => u.plan === "pro").length;
  const free = total - paid;
  const totalPrompts = users.reduce((s, u) => s + (u.prompts_used ?? 0), 0);

  const stats = [
    { label: "Total users", value: total, color: "text-bb-phantom" },
    { label: "Pro", value: paid, color: "text-violet-600" },
    { label: "Free", value: free, color: "text-gray-500" },
    { label: "Prompts run", value: totalPrompts, color: "text-bb-blue" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(({ label, value, color }, i) => (
        <div
          key={label}
          className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
          style={{ animation: `cardIn 0.4s ${i * 60}ms cubic-bezier(0.22,1,0.36,1) both` }}
        >
          <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ i }: { i: number }) {
  return (
    <tr className="animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-32" />
            <div className="h-2.5 bg-gray-100 rounded w-24" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-100 rounded-full w-12" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-10" /></td>
      <td className="w-8" />
    </tr>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  index,
  token,
  onUpdated,
  onError,
}: {
  user: AdminUser;
  index: number;
  token: string;
  onUpdated: (u: AdminUser) => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [localPlan, setLocalPlan] = useState(user.plan);
  const [localPrompts, setLocalPrompts] = useState(String(user.prompts_used ?? 0));
  const debounceRef = { current: null as ReturnType<typeof setTimeout> | null };

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const avatarBg = ["bg-violet-200", "bg-blue-200", "bg-emerald-200", "bg-amber-200", "bg-rose-200"][
    user.email.charCodeAt(0) % 5
  ];

  const save = useCallback(
    async (plan: string, promptsStr: string) => {
      const prompts_used = parseInt(promptsStr, 10);
      if (isNaN(prompts_used)) return;
      setSaving(true);
      try {
        const updated = await patchUser(token, user.user_id, { plan, prompts_used });
        onUpdated(updated);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [token, user.user_id, onUpdated, onError],
  );

  function handlePlanChange(next: string) {
    setLocalPlan(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(next, localPrompts), 600);
  }

  function handlePromptsChange(val: string) {
    setLocalPrompts(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(localPlan, val), 800);
  }

  return (
    <tr
      className="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors duration-150"
      style={{ animation: `rowIn 0.35s ${index * 40}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold text-gray-700 shrink-0`}>
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-bb-phantom truncate leading-tight">
              {user.name || "—"}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Plan */}
      <td className="px-4 py-3">
        <select
          value={localPlan}
          onChange={(e) => handlePlanChange(e.target.value)}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-bb-blue/30 transition-all ${planColor(localPlan)}`}
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
        </select>
      </td>

      {/* Prompts used */}
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={localPrompts}
          onChange={(e) => handlePromptsChange(e.target.value)}
          className="w-16 text-sm text-center border border-gray-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-bb-blue/30 focus:border-bb-blue transition-all"
        />
      </td>

      {/* Provider */}
      <td className="px-4 py-3">
        <span className="flex items-center gap-1">{providerIcon(user.provider)}</span>
      </td>

      {/* Stripe */}
      <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[120px]">
        {user.stripe_customer_id || <span className="italic text-gray-300">—</span>}
      </td>

      {/* Spinner */}
      <td className="px-4 py-3 w-8">
        {saving && (
          <svg className="w-4 h-4 text-bb-blue animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Saving">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        )}
      </td>
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="text-bb-phantom/20" style={{ animation: "emptyFloat 3s ease-in-out infinite" }} aria-hidden>
        <svg width="80" height="80" viewBox="0 0 100 100" fill="currentColor">
          <ellipse cx="50" cy="72" rx="24" ry="20" />
          <ellipse cx="24" cy="50" rx="11" ry="13" />
          <ellipse cx="42" cy="40" rx="11" ry="13" />
          <ellipse cx="60" cy="40" rx="11" ry="13" />
          <ellipse cx="77" cy="50" rx="11" ry="13" />
        </svg>
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-bb-phantom">No users yet</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Once people sign up, they&apos;ll appear here — go fetch some users!
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  }, []);

  const loadUsers = useCallback(async (token: string) => {
    setError("");
    setUsers(null);
    try {
      const data = await listUsers(token);
      setUsers(data.users);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/");
      return;
    }
    loadUsers(token);
  }, [router, loadUsers]);

  function handleUpdated(updated: AdminUser) {
    setUsers((prev) =>
      prev ? prev.map((u) => (u.user_id === updated.user_id ? updated : u)) : prev,
    );
    showToast(`Saved ${updated.email}`, "success");
  }

  const token = getStoredToken();
  const filtered = users
    ? users.filter(
        (u) =>
          u.email.includes(search.toLowerCase()) ||
          (u.name || "").toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  const isForbidden = error.includes("403") || error.toLowerCase().includes("forbidden");

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ animation: "pageIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-bb-phantom">User Management</h1>
          {users !== null && (
            <p className="text-xs text-bb-steel mt-0.5">
              {users.length} user{users.length !== 1 ? "s" : ""} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {users !== null && users.length > 0 && (
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-bb-blue/30 focus:border-bb-blue transition-all w-44"
              />
            </div>
          )}
          <button
            onClick={() => token && loadUsers(token)}
            title="Refresh"
            className="p-1.5 rounded-lg text-gray-400 hover:text-bb-blue hover:bg-bb-blue/5 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-bb-blue/30"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M13.5 2.5A6.5 6.5 0 1 1 8 1.5" strokeLinecap="round" />
              <path d="M13.5 2.5V6H10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Forbidden state */}
        {isForbidden && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="text-red-200" style={{ animation: "emptyFloat 3s ease-in-out infinite" }} aria-hidden>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-bb-phantom">Not authorized</h2>
              <p className="text-sm text-gray-400 max-w-xs">
                Your account isn&apos;t on the admin list. Ask someone with access to add your email to <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">ADMIN_EMAILS</code>.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-bb-phantom text-white px-5 py-2 text-sm font-medium hover:bg-bb-phantom/80 active:scale-[0.97] transition-all"
            >
              ← Go home
            </button>
          </div>
        )}

        {/* Generic error */}
        {error && !isForbidden && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}

        {/* Stats */}
        {!error && users !== null && users.length > 0 && <StatsBar users={users} />}

        {/* Table */}
        {!error && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Prompts</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Provider</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Stripe ID</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {users === null && !error &&
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} i={i} />)}

                {users !== null && filtered.length === 0 && !search && (
                  <tr>
                    <td colSpan={6}><EmptyState /></td>
                  </tr>
                )}

                {users !== null && filtered.length === 0 && search && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                      No users match &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                )}

                {token && filtered.map((user, i) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    index={i}
                    token={token}
                    onUpdated={handleUpdated}
                    onError={(msg) => showToast(msg, "error")}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes emptyFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
