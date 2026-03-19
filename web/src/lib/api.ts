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
};

export async function createRun(websiteUrl: string): Promise<{ run_id: string }> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website_url: websiteUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRun(runId: string): Promise<RunStatus> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`);
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
