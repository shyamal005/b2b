import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Register() {
  const { register, token } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      nav("/", { replace: true });
    } catch {
      setError("Could not register. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            ProcureFlow
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Create account</h1>
          <p className="mt-2 text-sm text-slate-400">Start a workspace for your organization.</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur"
        >
          <label className="block text-sm font-medium text-slate-200">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-indigo-500/0 transition focus:ring-2"
          />
          <label className="mt-4 block text-sm font-medium text-slate-200">Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-indigo-500/0 transition focus:ring-2"
          />
          <label className="mt-4 block text-sm font-medium text-slate-200">Password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-indigo-500/0 transition focus:ring-2"
          />
          {error ? (
            <p className="mt-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link className="font-medium text-indigo-300 hover:text-indigo-200" to="/login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
