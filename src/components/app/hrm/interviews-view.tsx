"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createInterviewAction, decideInterviewAction } from "@/server/actions/hrm/recruitment";
import type { Interview, Employee } from "@/lib/db/schema";
import { INTERVIEW_TYPES, INTERVIEW_STATUSES } from "@/lib/validations/hrm";

interface Props {
  interviews: Interview[];
  employees: Pick<Employee, "id" | "fullName">[];
  applications: { id: string; applicantName: string; jobId: string }[];
  jobPostings: { id: string; title: string }[];
  canUpdate: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
  no_show: "bg-red-100 text-red-700",
};

export default function InterviewsView({ interviews, employees, applications, jobPostings, canUpdate }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState<Interview | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const jobTitle = (jobId: string) => jobPostings.find((j) => j.id === jobId)?.title ?? "—";
  const appName = (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    return app ? `${app.applicantName} (${jobTitle(app.jobId)})` : appId;
  };

  const [schedState, schedAction, schedPending] = useActionState(createInterviewAction, null);
  if (schedState && !schedState.success) toast.error(schedState.error);
  if (schedState?.success && scheduleOpen) { setScheduleOpen(false); toast.success("Interview scheduled."); }

  const [decState, decAction, decPending] = useActionState(decideInterviewAction, null);
  if (decState && !decState.success) toast.error(decState.error);
  if (decState?.success && decideOpen) { setDecideOpen(null); toast.success("Interview updated."); }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Interviews</h1>
        {canUpdate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setScheduleOpen(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            + Schedule Interview
          </button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Applicant", "Date", "Time", "Type", "Status", "Rating", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {interviews.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No interviews scheduled.</td></tr>
            )}
            {interviews.map((iv) => (
              <tr key={iv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{appName(iv.applicationId)}</td>
                <td className="px-4 py-3">{iv.scheduledDate}</td>
                <td className="px-4 py-3">{iv.scheduledTime ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{iv.type.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[iv.status] ?? ""}`}>
                    {iv.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">{iv.rating ?? "—"}/5</td>
                <td className="px-4 py-3">
                  {canUpdate && iv.status === "scheduled" && (
                    <button
                      onClick={() => setDecideOpen(iv)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Update
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schedule Dialog */}
      {scheduleOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Schedule Interview</h2>
            <form key={dialogKey} action={schedAction} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Application *</label>
                <select name="applicationId" required className={SELECT_CLASS}>
                  <option value="">— Select —</option>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>{a.applicantName} ({jobTitle(a.jobId)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Interviewer</label>
                <select name="interviewerId" className={SELECT_CLASS}>
                  <option value="">— None —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input name="scheduledDate" type="date" required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input name="scheduledTime" type="time" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select name="type" className={SELECT_CLASS}>
                  {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setScheduleOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={schedPending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {schedPending ? "Saving…" : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decide Dialog */}
      {decideOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Update Interview Outcome</h2>
            <form action={decAction} className="space-y-3">
              <input type="hidden" name="id" value={decideOpen.id} />
              <div>
                <label className="block text-sm font-medium mb-1">Outcome *</label>
                <select name="status" required className={SELECT_CLASS}>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rating (1–5)</label>
                <input name="rating" type="number" min="1" max="5" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Feedback</label>
                <textarea name="feedback" rows={3} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDecideOpen(null)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={decPending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {decPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
