const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type RunStatus = {
  run_id: string;
  status: string;
  website_url: string;
  project_name: string;
  project_description: string;
  documents: { id: string; title: string }[];
  competitors: { id: string; name: string }[];
  competitor_report?: {
    title: string;
    date: string;
    executive_summary: string;
    rows: { competitor: string; category: string; pricing: string }[];
  };
  brand_voice_snippet: string;
  audit_summary: string;
  analytics_overview: { key: string; label: string; score: number; tone: string }[];
  passed_checks: { name: string; description: string; value: string; passed: boolean }[];
  failed_checks: { name: string; description: string; value: string; passed: boolean }[];
  feed_items: { id: string; title: string; status: string; description: string; how_to_fix: string; action_label: string }[];
  chat_status: string;
  chat_messages: { role: string; content: string }[];
  credits: number;
  llm_provider: string;
  model_name: string;
};

export type UserInfo = {
  user_id: string;
  token: string;
  email: string;
  plan: string;
  prompts_used: number;
  prompts_limit: number;
};

export const TOKEN_KEY = "cmodog_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function signUp(email: string, password: string): Promise<UserInfo> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(email: string, password: string): Promise<UserInfo> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function googleAuthUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

export async function getMe(token: string): Promise<UserInfo> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { "x-user-token": token },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createRun(
  websiteUrl: string,
  token: string,
  llmProvider?: string,
  modelName?: string,
): Promise<{ run_id: string }> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-token": token,
    },
    body: JSON.stringify({
      website_url: websiteUrl,
      llm_provider: llmProvider ?? "openrouter",
      model_name: modelName ?? "anthropic/claude-sonnet-4-5",
    }),
  });
  if (res.status === 402) {
    const data = await res.json();
    const detail = data.detail || {};
    throw Object.assign(new Error("limit_reached"), { code: "limit_reached", detail });
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type RunSummary = {
  run_id: string;
  user_id: string;
  website_url: string;
  project_name: string;
  status: string;
  created_at: string;
  scores: Record<string, number>;
  issues_count: number;
  passed_count: number;
};

export async function getRun(runId: string, token?: string | null): Promise<RunStatus> {
  const headers: Record<string, string> = {};
  if (token) headers["x-user-token"] = token;
  const res = await fetch(`${API_BASE}/api/runs/${runId}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getHistory(token: string): Promise<{ runs: RunSummary[] }> {
  const res = await fetch(`${API_BASE}/api/history`, {
    headers: { "x-user-token": token },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function streamRunUrl(runId: string): string {
  return `${API_BASE}/api/runs/${runId}/stream`;
}

export async function chatRun(
  runId: string,
  message: string,
): Promise<{ messages: RunStatus["chat_messages"] }> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createCheckout(token: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/billing/checkout`, {
    method: "POST",
    headers: { "x-user-token": token },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createBillingPortal(token: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/billing/portal`, {
    method: "POST",
    headers: { "x-user-token": token },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type AdminUser = {
  user_id: string;
  email: string;
  name: string;
  avatar: string;
  plan: string;
  prompts_used: number;
  provider: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
};

export async function listUsers(token: string): Promise<{ users: AdminUser[] }> {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: { "x-user-token": token },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchUser(
  token: string,
  userId: string,
  fields: { plan?: string; prompts_used?: number },
): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-token": token },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
