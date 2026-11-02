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
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </h1>
      <input
        className="w-full rounded border p-2"
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="w-full rounded border p-2"
        type="password"
        placeholder="Mot de passe (6 caractères minimum)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={6}
        required
      />
      {message && <p className="text-sm text-red-600">{message}</p>}
      <button type="submit" disabled={loading} className="w-full rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">
        {loading ? "Patientez…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="w-full text-sm text-green-700 underline"
      >
        {mode === "login" ? "Pas encore de compte ? Créer un compte" : "J'ai déjà un compte"}
      </button>
    </form>
  );
}