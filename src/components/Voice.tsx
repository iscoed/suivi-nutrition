import { useRef, useState } from "react";

interface Props {
  onText: (text: string) => void;
}

export default function Voice({ onText }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  const w = window as any;
  const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  function toggle() {
    setError(null);
    if (!Rec) {
      setError("La dictée n'est pas disponible sur ce navigateur. Essayez Chrome ou Safari.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new Rec();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onerror = (e: any) => {
      setError(
        e.error === "not-allowed"
          ? "Autorisez le micro dans les réglages du navigateur."
          : "Je n'ai pas bien entendu, réessayez."
      );
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={toggle}
        className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
          listening ? "bg-red-500 text-white hover:bg-red-600" : "bg-sky-600 text-white hover:bg-sky-700"
        }`}
      >
        {listening ? "⏹ Arrêter" : "🎤 Dicter"}
      </button>
      {listening && <span className="text-xs text-gray-500">Je vous écoute, parlez naturellement…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}