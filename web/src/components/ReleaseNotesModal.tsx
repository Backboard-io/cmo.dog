"use client";

type Release = {
  version: string;
  date: string;
  label?: string;
  items: { emoji: string; text: string }[];
};

const RELEASES: Release[] = [
  {
    version: "v0.1.1",
    date: "Mar 2026",
    label: "Latest",
    items: [
      { emoji: "🔐", text: "Google sign-in and email/password auth" },
      { emoji: "💳", text: "Pro plan with Stripe — $5/month for unlimited analyses" },
      { emoji: "📊", text: "Usage indicator showing analyses remaining on free tier" },
      { emoji: "🐾", text: "Paw-print animations on the home page (the important stuff)" },
    ],
  },
  {
    version: "v0.1.0",
    date: "Mar 2026",
    items: [
      { emoji: "🏠", text: "Site Audit — flags broken links, slow pages, and missing meta" },
      { emoji: "🕵️", text: "Competitor Intel — compares your site against rivals" },
      { emoji: "🗣️", text: "Brand Voice — analyzes your tone and messaging consistency" },
      { emoji: "🔍", text: "SEO Fixes — surfaces quick wins to boost search ranking" },
      { emoji: "💬", text: "AI Chat — ask Onni follow-up questions about your report" },
    ],
  },
];

type Props = {
  onClose: () => void;
};

export function ReleaseNotesModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ animation: "fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bb-steel/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-bb-phantom flex items-center justify-center text-base">
              🐾
            </div>
            <div>
              <h2 className="text-base font-semibold text-bb-phantom leading-tight">
                What&apos;s new in Onni
              </h2>
              <p className="text-xs text-bb-steel">CMO.dog release notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-bb-steel hover:bg-bb-cloud transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Releases */}
        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 flex flex-col gap-6">
          {RELEASES.map((release) => (
            <div key={release.version} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-bb-phantom">
                  {release.version}
                </span>
                {release.label && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bb-blue text-white uppercase tracking-wide">
                    {release.label}
                  </span>
                )}
                <span className="text-xs text-bb-steel ml-auto">{release.date}</span>
              </div>
              <ul className="space-y-2">
                {release.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-bb-steel">
                    <span className="mt-px text-base leading-none flex-shrink-0">
                      {item.emoji}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-bb-steel/10 flex items-center justify-between">
          <a
            href="https://github.com/backboard-io/cmo.dog/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-bb-blue hover:underline"
          >
            View all releases →
          </a>
          <button
            onClick={onClose}
            className="text-xs text-bb-steel hover:text-bb-phantom transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
