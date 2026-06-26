"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { SELECT_CLASS } from "@/lib/ui-constants";
import {
  createApplicationAction,
  updateApplicationStatusAction,
  createInterviewAction,
  convertToEmployeeAction,
} from "@/server/actions/hrm/recruitment";
import type { JobPosting, JobApplication, Interview, Employee } from "@/lib/db/schema";
import { APPLICATION_STATUSES, APPLICATION_SOURCES, INTERVIEW_TYPES } from "@/lib/validations/hrm";

interface Props {
  job: JobPosting;
  applications: JobApplication[];
  interviews: Interview[];
  employees: Pick<Employee, "id" | "fullName">[];
  canUpdate: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-100 text-gray-700",
  screening: "bg-blue-100 text-blue-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-yellow-100 text-yellow-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function JobDetailView({ job, applications, interviews, employees, canUpdate }: Props) {
  const [appOpen, setAppOpen] = useState(false);
  const [ivOpen, setIvOpen] = useState<JobApplication | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [appState, appAction, appPending] = useActionState(createApplicationAction, null);
  if (appState && !appState.success) toast.error(appState.error);
  if (appState?.success && appOpen) { setAppOpen(false); toast.success("Application added."); }

  const [ivState, ivAction, ivPending] = useActionState(createInterviewAction, null);
  if (ivState && !ivState.success) toast.error(ivState.error);
  if (ivState?.success && ivOpen) { setIvOpen(null); toast.success("Interview scheduled."); }

  function handleStatusChange(appId: string, status: string) {
    startTransition(async () => {
      const res = await updateApplicationStatusAction(appId, status);
      if (res && !res.success) toast.error(res.error);
      else toast.success("Status updated.");
    });
  }

  function handleConvert(appId: string) {
    startTransition(async () => {
      const res = await convertToEmployeeAction(appId);
      if (!res.success) toast.error(res.error);
      else toast.success("Applicant converted to employee.");
    });
  }

  const appInterviews = (appId: string) => interviews.filter((iv) => iv.applicationId === appId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Job header */}
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {job.type.replace("_", " ")} &middot; {job.positionsCount} position{Number(job.positionsCount) !== 1 ? "s" : ""}
              {job.closingDate ? ` · closes ${job.closingDate}` : ""}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${job.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {job.status}
          </span>
        </div>
        {job.description && <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">{job.description}</p>}
      </div>

      {/* Applications kanban */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Applications ({applications.length})</h2>
        {canUpdate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setAppOpen(true); }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            + Add Application
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {APPLICATION_STATUSES.map((col) => {
            const colApps = applications.filter((a) => a.status === col);
            return (
              <div key={col} className="w-56 flex-shrink-0">
                <div className={`text-xs font-medium px-2 py-1 rounded mb-2 ${STATUS_COLORS[col] ?? "bg-gray-100 text-gray-700"}`}>
                  {col.toUpperCase()} ({colApps.length})
                </div>
                <div className="space-y-2">
                  {colApps.map((app) => (
                    <div key={app.id} className="bg-white border rounded p-3 shadow-sm text-sm">
                      <p className="font-medium">{app.applicantName}</p>
                      <p className="text-gray-500 text-xs">{app.source} · {app.appliedDate}</p>
                      {canUpdate && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {APPLICATION_STATUSES.filter((s) => s !== app.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(app.id, s)}
                              disabled={isPending}
                              className="text-xs px-1.5 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              → {s}
                            </button>
                          ))}
                          {app.status === "hired" && (
                            <button
                              onClick={() => handleConvert(app.id)}
                              disabled={isPending}
                              className="text-xs px-1.5 py-0.5 bg-green-600 text-white rounded disabled:opacity-50"
                            >
                              Create Employee
                            </button>
                          )}
                          {(app.status === "screening" || app.status === "interview") && (
                            <button
                              onClick={() => setIvOpen(app)}
                              className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded"
                            >
                              + Interview
                            </button>
                          )}
                        </div>
                      )}
                      {appInterviews(app.id).length > 0 && (
                        <div className="mt-2 border-t pt-1">
                          {appInterviews(app.id).map((iv) => (
                            <p key={iv.id} className="text-xs text-gray-500">
                              {iv.scheduledDate} {iv.scheduledTime ?? ""} · {iv.type} · {iv.status}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Application Dialog */}
      {appOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Application</h2>
            <form key={dialogKey} action={appAction} className="space-y-3">
              <input type="hidden" name="jobId" value={job.id} />
              <div>
                <label className="block text-sm font-medium mb-1">Applicant Name *</label>
                <input name="applicantName" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input name="email" type="email" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input name="phone" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Source</label>
                  <select name="source" className={SELECT_CLASS}>
                    {APPLICATION_SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Applied Date *</label>
                  <input name="appliedDate" type="date" required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAppOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={appPending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {appPending ? "Saving…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Interview Dialog */}
      {ivOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Schedule Interview — {ivOpen.applicantName}</h2>
            <form action={ivAction} className="space-y-3">
              <input type="hidden" name="applicationId" value={ivOpen.id} />
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIvOpen(null)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={ivPending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {ivPending ? "Saving…" : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
