import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setMessage(error.message);
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center p-4"
      style={{ backgroundImage: "url(/images/connexion.jpg)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800/80 via-emerald-600/70 to-teal-500/60" />
      <form onSubmit={submit} className="relative w-full max-w-sm space-y-4 rounded-3xl bg-white/95 p-8 shadow-xl backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Suivi nutrition</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "login" ? "Connectez-vous à votre espace" : "Créez votre espace personnel"}
          </p>
        </div>

        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          type="password"
          placeholder="Mot de passe (6 caractères minimum)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-emerald-600 py-3 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Patientez…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-sm font-medium text-emerald-700 hover:underline"
        >
          {mode === "login" ? "Pas encore de compte ? Créer un compte" : "J'ai déjà un compte"}
        </button>
      </form>
    </div>
  );
}