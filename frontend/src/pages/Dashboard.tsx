import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  your_role: "admin" | "approver" | "member";
};

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const orgs = useQuery({
    queryKey: ["orgs"],
    queryFn: () =>
      apiFetch<{ organizations: OrgRow[] }>("/api/orgs", { token, credentials: "include" }),
    enabled: !!token,
  });

  const createOrg = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/api/orgs", {
        method: "POST",
        token,
        body: JSON.stringify({ name, slug }),
      }),
    onSuccess: () => {
      setName("");
      setSlug("");
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: () => {
      setFormError("Could not create organization (check slug format: lowercase, hyphens).");
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              ProcureFlow
            </p>
            <h1 className="text-lg font-semibold">Organizations</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Create organization</h2>
          <p className="mt-1 text-sm text-slate-600">
            You become the admin. Slug must be lowercase letters, numbers, and hyphens only.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createOrg.mutate();
            }}
          >
            <div>
              <label className="text-xs font-medium text-slate-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500/0 focus:ring-2"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500/0 focus:ring-2"
                placeholder="acme-corp"
              />
            </div>
            {formError ? <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p> : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={createOrg.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {createOrg.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-800">Your workspaces</h2>
          {orgs.isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : orgs.isError ? (
            <p className="mt-4 text-sm text-rose-600">Could not load organizations.</p>
          ) : orgs.data?.organizations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No organizations yet. Create one above.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {(orgs.data?.organizations ?? []).map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/orgs/${o.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    <p className="text-sm text-slate-500">/{o.slug}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-indigo-600">
                      Your role: {o.your_role}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
