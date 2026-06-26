"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createJobPostingAction } from "@/server/actions/hrm/recruitment";
import type { JobPosting, Department, Designation } from "@/lib/db/schema";
import { JOB_STATUSES, JOB_TYPES } from "@/lib/validations/hrm";

interface Props {
  jobs: JobPosting[];
  departments: Department[];
  designations: Designation[];
  canCreate: boolean;
  canUpdate: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  open: "bg-green-100 text-green-700",
  closed: "bg-red-100 text-red-700",
  cancelled: "bg-yellow-100 text-yellow-700",
};

export default function JobsView({ jobs, departments, designations, canCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const [state, action, pending] = useActionState(createJobPostingAction, null);
  if (state && !state.success) toast.error(state.error);
  if (state?.success && open) { setOpen(false); toast.success("Job posting created."); }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Job Postings</h1>
        {canCreate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            + New Posting
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500">No job postings yet.</div>
        )}
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/app/hrm/recruitment/jobs/${job.id}` as Route}
            className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900">{job.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[job.status] ?? ""}`}>
                {job.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {job.type.replace("_", " ")} &middot; {job.positionsCount} position{Number(job.positionsCount) !== 1 ? "s" : ""}
            </p>
            {job.closingDate && (
              <p className="text-xs text-gray-400 mt-2">Closes: {job.closingDate}</p>
            )}
          </Link>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">New Job Posting</h2>
            <form key={dialogKey} action={action} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input name="title" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select name="type" className={SELECT_CLASS}>
                    {JOB_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Positions</label>
                  <input name="positionsCount" type="number" defaultValue="1" min="1" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select name="departmentId" className={SELECT_CLASS}>
                    <option value="">— None —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Designation</label>
                  <select name="designationId" className={SELECT_CLASS}>
                    <option value="">— None —</option>
                    {designations.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Posted Date</label>
                  <input name="postedDate" type="date" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Closing Date</label>
                  <input name="closingDate" type="date" className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select name="status" className={SELECT_CLASS}>
                  {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" rows={3} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={pending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {pending ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
