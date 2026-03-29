import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

type Role = "admin" | "approver" | "member";

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  your_role: Role;
  members: Array<{ user_id: string; email: string; name: string; role: Role }>;
};

type RequestRow = {
  id: string;
  org_id: string;
  requester_id: string;
  title: string;
  description: string;
  amount_cents: number;
  currency: string;
  status: "draft" | "pending" | "approved" | "rejected";
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  requester_email: string;
  requester_name: string;
};

function formatMoney(cents: number, currency: string) {
  const n = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export default function OrgPage() {
  const { orgId } = useParams();
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("member");
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqAmount, setReqAmount] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const org = useQuery({
    queryKey: ["org", orgId],
    enabled: !!token && !!orgId,
    queryFn: () =>
      apiFetch<OrgDetail>(`/api/orgs/${orgId}`, { token, credentials: "include" }),
  });

  const requests = useQuery({
    queryKey: ["requests", orgId],
    enabled: !!token && !!orgId,
    queryFn: () =>
      apiFetch<{ requests: RequestRow[] }>(`/api/organizations/${orgId}/requests`, {
        token,
        credentials: "include",
      }),
  });

  const addMember = useMutation({
    mutationFn: () =>
      apiFetch(`/api/orgs/${orgId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      }),
    onSuccess: () => {
      setMemberEmail("");
      void qc.invalidateQueries({ queryKey: ["org", orgId] });
    },
  });

  const createRequest = useMutation({
    mutationFn: () => {
      const dollars = Number.parseFloat(reqAmount);
      const amount_cents = Math.round(dollars * 100);
      return apiFetch<{ id: string }>(`/api/organizations/${orgId}/requests`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: reqTitle,
          description: reqDesc,
          amount_cents,
          currency: "USD",
        }),
      });
    },
    onSuccess: () => {
      setReqTitle("");
      setReqDesc("");
      setReqAmount("");
      void qc.invalidateQueries({ queryKey: ["requests", orgId] });
    },
  });

  const submitRequest = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/requests/${id}/submit`, { method: "POST", token }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["requests", orgId] }),
  });

  const approveRequest = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/requests/${id}/approve`, { method: "POST", token }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["requests", orgId] }),
  });

  const rejectRequest = useMutation({
    mutationFn: (p: { id: string; note: string }) =>
      apiFetch(`/api/requests/${p.id}/reject`, {
        method: "POST",
        token,
        body: JSON.stringify({ note: p.note }),
      }),
    onSuccess: () => {
      setRejectFor(null);
      setRejectNote("");
      void qc.invalidateQueries({ queryKey: ["requests", orgId] });
    },
  });

  if (!orgId) {
    return <NavigateMissing />;
  }

  if (org.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (org.isError || !org.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-rose-600">Organization not found or access denied.</p>
        <Link className="mt-4 inline-block text-indigo-600 hover:underline" to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const o = org.data;
  const canDecide = o.your_role === "admin" || o.your_role === "approver";
  const list = requests.data?.requests ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              to="/"
              className="text-xs font-semibold uppercase tracking-widest text-indigo-600 hover:text-indigo-500"
            >
              ← Organizations
            </Link>
            <h1 className="text-xl font-semibold">{o.name}</h1>
            <p className="text-sm text-slate-500">
              /{o.slug} · you are <span className="font-medium text-slate-700">{o.your_role}</span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        {o.your_role === "admin" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Add member</h2>
            <p className="mt-1 text-sm text-slate-600">
              User must already be registered. Approvers can approve or reject pending requests.
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addMember.mutate();
              }}
            >
              <div className="min-w-[200px] flex-1">
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="member">member</option>
                  <option value="approver">approver</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={addMember.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {addMember.isPending ? "Adding…" : "Add"}
              </button>
            </form>
            {addMember.isError ? (
              <p className="mt-2 text-sm text-rose-600">
                Could not add (user may not exist or is already a member).
              </p>
            ) : null}
            <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-4 text-sm">
              {o.members.map((m) => (
                <li key={m.user_id} className="flex justify-between py-2">
                  <span>
                    {m.name}{" "}
                    <span className="text-slate-500">({m.email})</span>
                  </span>
                  <span className="font-medium text-indigo-700">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Members</h2>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {o.members.map((m) => (
                <li key={m.user_id} className="flex justify-between py-2">
                  <span>
                    {m.name}{" "}
                    <span className="text-slate-500">({m.email})</span>
                  </span>
                  <span className="font-medium text-indigo-700">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">New purchase request</h2>
          <p className="mt-1 text-sm text-slate-600">
            Saved as <strong>draft</strong>. Submit when ready for approval.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createRequest.mutate();
            }}
          >
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Title</label>
              <input
                required
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Description</label>
              <textarea
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={createRequest.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {createRequest.isPending ? "Saving…" : "Save draft"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-base font-semibold">Requests</h2>
          {requests.isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {list.map((rq) => (
                <li
                  key={rq.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{rq.title}</p>
                      <p className="text-sm text-slate-600">{rq.description || "—"}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        By {rq.requester_name} · {rq.requester_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">
                        {formatMoney(rq.amount_cents, rq.currency)}
                      </p>
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          rq.status === "approved"
                            ? "text-emerald-600"
                            : rq.status === "rejected"
                              ? "text-rose-600"
                              : rq.status === "pending"
                                ? "text-amber-600"
                                : "text-slate-500"
                        }`}
                      >
                        {rq.status}
                      </p>
                    </div>
                  </div>
                  {rq.status === "rejected" && rq.decision_note ? (
                    <p className="mt-3 text-sm text-rose-700">Reason: {rq.decision_note}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {rq.status === "draft" && rq.requester_id === user?.id ? (
                      <button
                        type="button"
                        onClick={() => submitRequest.mutate(rq.id)}
                        disabled={submitRequest.isPending}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
                      >
                        Submit for approval
                      </button>
                    ) : null}
                    {rq.status === "pending" && canDecide ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approveRequest.mutate(rq.id)}
                          disabled={approveRequest.isPending}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectFor(rq.id);
                            setRejectNote("");
                          }}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 hover:bg-rose-100"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                  {rejectFor === rq.id ? (
                    <form
                      className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rejectRequest.mutate({ id: rq.id, note: rejectNote });
                      }}
                    >
                      <input
                        required
                        placeholder="Reason for rejection"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={rejectRequest.isPending}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectFor(null)}
                        className="text-sm text-slate-600"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function NavigateMissing() {
  return (
    <div className="p-10 text-center">
      <p className="text-rose-600">Missing organization id.</p>
      <Link className="mt-4 inline-block text-indigo-600" to="/">
        Home
      </Link>
    </div>
  );
}
