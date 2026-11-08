export const todayIso = () => new Date().toLocaleDateString("en-CA");
export const mondayOf = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toLocaleDateString("en-CA");
};
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};
export const formatDate = (iso: string, language: "ro" | "en" = "ro") => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T12:00:00"));
};
export const formatShortDate = (iso: string, language: "ro" | "en" = "ro") => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", { day: "2-digit", month: "short" }).format(new Date(iso + "T12:00:00"));
};
export const isoInRange = (iso: string, start: string, end: string) => Boolean(iso && iso >= start && iso <= end);
