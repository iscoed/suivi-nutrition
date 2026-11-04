import { useState } from "react";

interface Props {
  context: Record<string, unknown>;
}

interface Msg { role: "user" | "coach"; text: string }

const field = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export default function Chat({ context }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = await r.json();
      const text = r.ok ? data.answer : data.error ?? "Une erreur est survenue.";
      setMessages((m) => [...m, { role: "coach", text }]);
    } catch {
      setMessages((m) => [...m, { role: "coach", text: "Connexion impossible, réessayez." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <h2 className="mb-1 font-semibold">Poser une question</h2>
      <p className="mb-4 text-sm text-gray-500">Nutrition, repas, eau, suivi : je vous réponds. Pour un souci de santé, voyez un médecin.</p>

      {messages.length > 0 && (
        <div className="mb-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`rounded-2xl p-3 text-sm ${m.role === "user" ? "ml-8 bg-emerald-600 text-white" : "mr-8 bg-gray-100 text-gray-800"}`}>
              {m.text}
            </div>
          ))}
          {loading && <p className="text-xs text-gray-400">Le coach réfléchit…</p>}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={field}
          placeholder="Ex. Je peux manger du fromage ce soir ?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </section>
  );
}