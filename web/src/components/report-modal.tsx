"use client";

import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RunStatus } from "@/lib/api";

type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: RunStatus | null;
};

export function ReportModal({ open, onOpenChange, run }: ReportModalProps) {
  const report = run?.competitor_report;
  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto bg-bb-cloud border-bb-steel/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {report.title}: {run?.project_name || "Project"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-gray-500">{report.date}</p>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{report.executive_summary}</ReactMarkdown>
          </div>
          {report.rows.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="px-4 py-2 font-medium">Competitor</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-200 hover:bg-gray-50/80"
                    >
                      <td className="px-4 py-2">{row.competitor.replace(/\*\*/g, "")}</td>
                      <td className="px-4 py-2">{row.category.replace(/\*\*/g, "")}</td>
                      <td className="px-4 py-2">{row.pricing.replace(/\*\*/g, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
