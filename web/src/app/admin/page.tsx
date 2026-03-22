"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, listUsers, patchUser, bulkDeleteUsers, type AdminUser } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planColor(plan: string) {
  if (plan === "pro") return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
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

function avatarBgClass(email: string) {
  return ["bg-violet-200", "bg-blue-200", "bg-emerald-200", "bg-amber-200", "bg-rose-200"][
    email.charCodeAt(0) % 5
  ];
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
      <td className="w-12" />
    </tr>
  );
}

// ─── Selectable Avatar ─────────────────────────────────────────────────────────

function SelectableAvatar({
  user,
  isSelected,
  isDeleting,
  onToggle,
}: {
  user: AdminUser;
  isSelected: boolean;
  isDeleting: boolean;
  onToggle: () => void;
}) {
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const bg = avatarBgClass(user.email);

  return (
    <button
      onClick={onToggle}
      aria-label={isSelected ? `Deselect ${user.email}` : `Select ${user.email}`}
      className={`relative w-8 h-8 rounded-full shrink-0 focus:outline-none transition-all duration-200
        ${isSelected ? "scale-90" : "hover:scale-105 active:scale-95"}
        ${isDeleting ? "opacity-0 scale-50" : ""}
      `}
      style={isDeleting ? { transition: "all 0.35s cubic-bezier(0.4,0,1,1)" } : undefined}
    >
      {/* Avatar image or initials */}
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt=""
          className={`w-full h-full rounded-full object-cover transition-all duration-200 ${isSelected ? "brightness-50" : ""}`}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full ${bg} flex items-center justify-center text-xs font-bold text-gray-700 transition-all duration-200 ${isSelected ? "brightness-50" : ""}`}
        >
          {initials}
        </div>
      )}

      {/* Selection ring */}
      {isSelected && (
        <span
          className="absolute inset-0 rounded-full ring-2 ring-red-400"
          style={{ animation: "ringPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}
        />
      )}

      {/* Checkmark overlay */}
      {isSelected && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: "checkPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" aria-hidden>
            <path d="M3 8l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ─── Floating Delete Bar ──────────────────────────────────────────────────────

type DeleteBarState = "idle" | "confirming" | "deleting";

function FloatingDeleteBar({
  count,
  onClear,
  onConfirm,
}: {
  count: number;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const [phase, setPhase] = useState<DeleteBarState>("idle");

  function handleDeleteClick() {
    setPhase("confirming");
  }

  function handleConfirm() {
    setPhase("deleting");
    onConfirm();
  }

  function handleCancel() {
    setPhase("idle");
  }

  // Reset phase if count changes (e.g. selection cleared externally)
  useEffect(() => { setPhase("idle"); }, [count]);

  const skull = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.86 3.82 7.58L7 20v1a1 1 0 001 1h8a1 1 0 001-1v-1l.18-1.42A9 9 0 0021 11c0-4.97-4.03-9-9-9zm-2.5 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex items-center"
      style={{
        transform: "translateX(-50%)",
        animation: "barSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      {phase === "idle" && (
        <div className="flex items-center gap-3 bg-bb-phantom text-white px-4 py-2.5 rounded-2xl shadow-2xl shadow-bb-phantom/30 border border-white/10">
          <span className="text-sm font-semibold tabular-nums">
            {count} {count === 1 ? "user" : "users"} selected
          </span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={onClear}
            className="text-xs text-white/60 hover:text-white transition-colors font-medium focus:outline-none"
          >
            Clear
          </button>
          <button
            onClick={handleDeleteClick}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-all focus:outline-none shadow-md shadow-red-900/30"
          >
            {skull}
            Delete {count === 1 ? "user" : `${count} users`}
          </button>
        </div>
      )}

      {phase === "confirming" && (
        <div
          className="flex items-center gap-3 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl shadow-red-600/40 border border-red-400/30"
          style={{ animation: "confirmShake 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <span className="text-sm font-semibold">☠️ This is permanent</span>
          <div className="w-px h-4 bg-white/30" />
          <button
            onClick={handleCancel}
            className="text-xs text-white/70 hover:text-white transition-colors font-medium focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-white text-red-600 text-sm font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all focus:outline-none shadow-md hover:bg-red-50"
          >
            Yes, delete {count === 1 ? "them" : `all ${count}`}
          </button>
        </div>
      )}

      {phase === "deleting" && (
        <div className="flex items-center gap-2.5 bg-bb-phantom text-white px-5 py-2.5 rounded-2xl shadow-2xl shadow-bb-phantom/30">
          <svg className="w-4 h-4 animate-spin text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold">Deleting…</span>
        </div>
      )}
    </div>
  );
}

// ─── Edit User Modal ───────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved";

function EditUserModal({
  user,
  token,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  token: string;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const [plan, setPlan] = useState(user.plan);
  const [prompts, setPrompts] = useState(user.prompts_used ?? 0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const overlayRef = useRef<HTMLDivElement>(null);
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const bg = avatarBgClass(user.email);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const isDirty = plan !== user.plan || prompts !== (user.prompts_used ?? 0);

  async function handleSave() {
    if (!isDirty) { onClose(); return; }
    setSaveState("saving");
    try {
      const updated = await patchUser(token, user.user_id, { plan, prompts_used: prompts });
      setSaveState("saved");
      setTimeout(() => { onSaved(updated); onClose(); }, 800);
    } catch {
      setSaveState("idle");
    }
  }

  function adjustPrompts(delta: number) {
    setPrompts((p) => Math.max(0, p + delta));
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: "overlayIn 0.2s ease both" }}
    >
      <div className="absolute inset-0 bg-bb-phantom/40 backdrop-blur-[3px]" />
      <div
        className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "modalSpring 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Hero header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-90 transition-all focus:outline-none"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-md ring-2 ring-white shrink-0" />
            ) : (
              <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center text-lg font-bold text-gray-700 shadow-md ring-2 ring-white shrink-0`}>
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-bb-phantom leading-tight truncate">{user.name || "—"}</h2>
              <p className="text-sm text-gray-400 truncate mt-0.5">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {providerIcon(user.provider)}
                {user.stripe_customer_id && (
                  <span className="text-[10px] font-mono text-gray-300 truncate max-w-[140px]" title={user.stripe_customer_id}>
                    {user.stripe_customer_id}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Plan selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {(["free", "pro"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 px-4 text-sm font-semibold transition-all duration-200 focus:outline-none active:scale-[0.97]
                    ${plan === p
                      ? p === "pro"
                        ? "border-violet-400 bg-violet-50 text-violet-700 shadow-md shadow-violet-100"
                        : "border-bb-blue/50 bg-bb-blue/5 text-bb-blue shadow-md shadow-bb-blue/10"
                      : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-gray-100"
                    }`}
                >
                  {p === "pro" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="opacity-80" aria-hidden>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-70" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8M12 8v8" strokeLinecap="round" />
                    </svg>
                  )}
                  <span className="capitalize">{p}</span>
                  {plan === p && (
                    <span
                      className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: p === "pro" ? "#7c3aed" : "#0066ff", animation: "checkPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5">
                        <path d="M1.5 4l1.5 1.5 3.5-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Prompts stepper */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Prompts used</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjustPrompts(-10)}
                disabled={prompts === 0}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:bg-gray-50 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all focus:outline-none"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10" strokeLinecap="round" /></svg>
              </button>
              <input
                type="number"
                min={0}
                value={prompts}
                onChange={(e) => setPrompts(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="flex-1 text-center text-xl font-bold tabular-nums text-bb-phantom border-2 border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-bb-blue/40 focus:ring-2 focus:ring-bb-blue/10 transition-all"
              />
              <button
                onClick={() => adjustPrompts(10)}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:bg-gray-50 active:scale-90 transition-all focus:outline-none"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
              </button>
              {prompts !== 0 && (
                <button
                  onClick={() => setPrompts(0)}
                  title="Reset to 0"
                  className="text-[10px] font-semibold text-gray-300 hover:text-red-400 transition-colors px-1 focus:outline-none"
                  style={{ animation: "fadeIn 0.2s ease both" }}
                >
                  reset
                </button>
              )}
            </div>
            <p className="text-xs text-gray-300 mt-2 text-center">Use +/− to adjust in steps of 10</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 active:scale-[0.97] transition-all focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || saveState === "saved"}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] focus:outline-none
              ${saveState === "saved"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                : isDirty
                  ? "bg-bb-phantom text-white shadow-md shadow-bb-phantom/20 hover:bg-bb-phantom/90"
                  : "bg-gray-100 text-gray-400 cursor-default"
              }`}
          >
            {saveState === "saving" && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
            )}
            {saveState === "saved" && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: "checkPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }} aria-hidden>
                <path d="M2.5 8l4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {saveState === "idle" && (isDirty ? "Save changes" : "No changes")}
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved!"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  index,
  isSelected,
  isDeleting,
  onToggleSelect,
  onEdit,
}: {
  user: AdminUser;
  index: number;
  isSelected: boolean;
  isDeleting: boolean;
  onToggleSelect: () => void;
  onEdit: (u: AdminUser) => void;
}) {
  return (
    <tr
      className={`group border-b border-gray-50 transition-all duration-200
        ${isSelected ? "bg-red-50/60" : "hover:bg-gray-50/60"}
        ${isDeleting ? "pointer-events-none" : ""}
      `}
      style={{
        animation: isDeleting
          ? "rowOut 0.35s cubic-bezier(0.4,0,1,1) both"
          : `rowIn 0.35s ${index * 40}ms cubic-bezier(0.22,1,0.36,1) both`,
      }}
    >
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <SelectableAvatar
            user={user}
            isSelected={isSelected}
            isDeleting={isDeleting}
            onToggle={onToggleSelect}
          />
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
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${planColor(user.plan)}`}>
          {user.plan}
        </span>
      </td>

      {/* Prompts used */}
      <td className="px-4 py-3">
        <span className="text-sm tabular-nums text-bb-phantom font-medium">{user.prompts_used ?? 0}</span>
      </td>

      {/* Provider */}
      <td className="px-4 py-3">
        <span className="flex items-center gap-1">{providerIcon(user.provider)}</span>
      </td>

      {/* Stripe */}
      <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[120px]">
        {user.stripe_customer_id || <span className="italic text-gray-300">—</span>}
      </td>

      {/* Edit button */}
      <td className="px-3 py-3 w-12">
        <button
          onClick={() => onEdit(user)}
          title="Edit user"
          className="p-1.5 rounded-lg text-gray-300 hover:text-bb-blue hover:bg-bb-blue/8 active:scale-90 opacity-0 group-hover:opacity-100 transition-all duration-150 focus:outline-none focus:opacity-100 focus:ring-2 focus:ring-bb-blue/30"
          aria-label={`Edit ${user.email}`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  }, []);

  const loadUsers = useCallback(async (token: string) => {
    setError("");
    setUsers(null);
    setSelectedIds(new Set());
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
    if (!token) { router.replace("/"); return; }
    loadUsers(token);
  }, [router, loadUsers]);

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => prev ? prev.map((u) => (u.user_id === updated.user_id ? updated : u)) : prev);
    showToast(`Saved ${updated.email}`, "success");
  }

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleDelete() {
    const token = getStoredToken();
    if (!token || selectedIds.size === 0) return;

    const ids = [...selectedIds];
    // Animate rows out first
    setDeletingIds(new Set(ids));

    // Wait for row exit animation
    await new Promise((r) => setTimeout(r, 380));

    try {
      await bulkDeleteUsers(token, ids);
      setUsers((prev) => prev ? prev.filter((u) => !ids.includes(u.user_id)) : prev);
      setSelectedIds(new Set());
      setDeletingIds(new Set());
      showToast(
        ids.length === 1 ? "User deleted" : `${ids.length} users deleted`,
        "success",
      );
    } catch (e) {
      setDeletingIds(new Set());
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  const token = getStoredToken();

  const filtered = useMemo(() =>
    users
      ? users.filter(
          (u) =>
            u.email.includes(search.toLowerCase()) ||
            (u.name || "").toLowerCase().includes(search.toLowerCase()),
        )
      : [],
    [users, search],
  );

  const isForbidden = error.includes("403") || error.toLowerCase().includes("forbidden");
  const hasSelection = selectedIds.size > 0;

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ animation: "pageIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {editingUser && token && (
        <EditUserModal
          user={editingUser}
          token={token}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {hasSelection && (
        <FloatingDeleteBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onConfirm={handleDelete}
        />
      )}

      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-bb-phantom">User Management</h1>
          {users !== null && (
            <p className="text-xs text-bb-steel mt-0.5">
              {users.length} user{users.length !== 1 ? "s" : ""} total
              {hasSelection && (
                <span className="ml-1.5 text-red-400 font-semibold" style={{ animation: "fadeIn 0.15s ease both" }}>
                  · {selectedIds.size} selected
                </span>
              )}
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
          {hasSelection && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-400 hover:text-bb-phantom transition-colors font-medium focus:outline-none"
              style={{ animation: "fadeIn 0.15s ease both" }}
            >
              Clear selection
            </button>
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
            <button onClick={() => router.push("/")} className="rounded-full bg-bb-phantom text-white px-5 py-2 text-sm font-medium hover:bg-bb-phantom/80 active:scale-[0.97] transition-all">
              ← Go home
            </button>
          </div>
        )}

        {error && !isForbidden && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}

        {!error && users !== null && users.length > 0 && <StatsBar users={users} />}

        {/* Hint when no selection yet and users exist */}
        {!error && users !== null && users.length > 0 && !hasSelection && (
          <p
            className="text-xs text-gray-300 text-center -mt-1"
            style={{ animation: "fadeIn 1s 0.8s ease both" }}
          >
            Tip: click an avatar to select users for deletion
          </p>
        )}

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
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {users === null && !error && [...Array(5)].map((_, i) => <SkeletonRow key={i} i={i} />)}

                {users !== null && filtered.length === 0 && !search && (
                  <tr><td colSpan={6}><EmptyState /></td></tr>
                )}

                {users !== null && filtered.length === 0 && search && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                      No users match &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                )}

                {filtered.map((user, i) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    index={i}
                    isSelected={selectedIds.has(user.user_id)}
                    isDeleting={deletingIds.has(user.user_id)}
                    onToggleSelect={() => toggleSelect(user.user_id)}
                    onEdit={setEditingUser}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom padding so floating bar doesn't cover last row */}
        {hasSelection && <div className="h-20" />}
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
        @keyframes rowOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(40px); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes emptyFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSpring {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes checkPop {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ringPop {
          from { opacity: 0; transform: scale(1.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes barSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes confirmShake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-5px); }
          40%  { transform: translateX(5px); }
          60%  { transform: translateX(-3px); }
          80%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
