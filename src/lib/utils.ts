export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100,
  );
export const dateBR = (value?: string | unknown) => {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const date =
    typeof value === "string"
      ? new Date(value)
      : (value as { toDate?: () => Date }).toDate?.();
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
      }).format(date)
    : "—";
};
export const dateTimeBR = (value?: string | unknown) => {
  if (!value) return "—";
  const date =
    typeof value === "string"
      ? new Date(value)
      : (value as { toDate?: () => Date }).toDate?.();
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "—";
};
export const moneyInput = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100) || 0;
export const moneyValue = (cents: number) => (cents / 100).toFixed(2);
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
export const localDateTime = (iso?: string) => {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
};
export const toIso = (local: string) => {
  if (!local) return "";
  const [date, time] = local.split("T");
  const [year, month, day] = (date || "").split("-").map(Number);
  const [hour, minute] = (time || "").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite))
    throw new Error("Data ou horário inválido.");
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let guess = desired;
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const shown = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    guess += desired - shown;
  }
  return new Date(guess).toISOString();
};
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
export function download(filename: string, text: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printDocument(title: string, html: string) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) throw new Error("Permita a janela de impressão no navegador.");
  w.opener = null;
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:15px Arial,sans-serif;max-width:750px;margin:48px auto;color:#222}h1{color:#3c5558}p{line-height:1.5}hr{border:0;border-top:1px solid #bbb;margin:24px 0}@media print{body{margin:15mm}}</style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}
export function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "permission-denied")
    return "Acesso negado pelas regras do Firebase. Confira sua conta e as permissões.";
  if (code === "auth/popup-closed-by-user") return "O login foi cancelado.";
  if (code === "auth/unauthorized-domain")
    return "Autorize este domínio em Firebase Authentication.";
  if (code === "unavailable")
    return "Sem conexão com o Firebase. Tente novamente.";
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}
