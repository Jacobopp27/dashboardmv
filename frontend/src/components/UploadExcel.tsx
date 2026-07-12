import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  /** Se llama tras una carga exitosa para refrescar los datos en pantalla */
  onUploaded: () => void;
}

/** Botón para subir archivos Excel directamente desde la web (cualquier PC o celular).
 *  Pide la clave de carga la primera vez y la recuerda en el navegador. */
export function UploadExcel({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const pedirClave = (): string | null => {
    let clave = localStorage.getItem("mv_upload_key");
    if (!clave) {
      clave = window.prompt("Clave de carga de archivos:");
      if (clave) localStorage.setItem("mv_upload_key", clave);
    }
    return clave;
  };

  const subir = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const clave = pedirClave();
    if (!clave) return;

    setSubiendo(true);
    setEstado("idle");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${BASE}/api/upload`, {
          method: "POST",
          headers: { "X-Upload-Key": clave },
          body: form,
        });
        if (res.status === 401) {
          localStorage.removeItem("mv_upload_key");  // clave errada: pedir de nuevo la próxima
          throw new Error("Clave incorrecta");
        }
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.detail ?? `Error ${res.status}`);
        }
      }
      setEstado("ok");
      setMensaje(`${files.length} archivo(s) subido(s)`);
      onUploaded();
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setEstado("idle"), 5000);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.xlsm"
        multiple
        className="hidden"
        onChange={(e) => subir(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        title="Subir archivo Excel nuevo (informe mensual, cartera, recaudo)"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ink-200 bg-white text-navy-700 hover:bg-navy-50 disabled:opacity-50 text-[13px] font-semibold transition-colors"
      >
        <Upload size={16} className={subiendo ? "animate-pulse" : ""} />
        <span className="hidden sm:inline">{subiendo ? "Subiendo…" : "Subir Excel"}</span>
      </button>
      {estado === "ok" && (
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#2D7A4F" }}>
          <CheckCircle2 size={13} /> {mensaje}
        </span>
      )}
      {estado === "error" && (
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#C73E3E" }}>
          <AlertTriangle size={13} /> {mensaje}
        </span>
      )}
    </div>
  );
}
