import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "../types";

const CONFIG_KEY = "car-work-supabase";
export type CloudConfig = { url: string; anonKey: string };

export const getCloudConfig = (): CloudConfig => {
  const env = {
    url: import.meta.env.VITE_SUPABASE_URL || "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
  };
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") as Partial<CloudConfig>;
    return { url: stored.url || env.url, anonKey: stored.anonKey || env.anonKey };
  } catch { return env; }
};

export const saveCloudConfig = (config: CloudConfig) => localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

export const getSupabase = (): SupabaseClient | null => {
  const { url, anonKey } = getCloudConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: true } });
};

export const uploadAll = async (client: SupabaseClient, data: AppData) => {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Sign in first");
  const user_id = auth.user.id;
  const write = async <T extends { id: string }>(table: string, rows: T[]) => {
    if (!rows.length) return;
    const { error } = await client.from(table).upsert(rows.map(payload => ({ id: payload.id, user_id, payload, updated_at: new Date().toISOString() })), { onConflict: "user_id,id" });
    if (error) throw error;
  };
  await write("jobs", data.jobs);
  await write("expenses", data.expenses);
  await write("payslips", data.payslips);
  await write("app_settings", [{
    id: "main",
    completedWeeks: data.completedWeeks ?? [],
    taxSettings: data.taxSettings,
    taxAdjustments: data.taxAdjustments ?? [],
    confirmedTaxPeriods: data.confirmedTaxPeriods ?? []
  }]);
};

export const downloadAll = async (client: SupabaseClient): Promise<AppData> => {
  const read = async (table: string) => {
    const { data, error } = await client.from(table).select("payload");
    if (error) throw error;
    return (data || []).map(row => row.payload);
  };
  const [jobs, expenses, payslips, settings] = await Promise.all([read("jobs"), read("expenses"), read("payslips"), read("app_settings")]);
  const appSettings = settings.find(item => item.id === "main") ?? {};
  const completedWeeks = (appSettings.completedWeeks ?? []) as string[];
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    jobs,
    expenses,
    payslips,
    completedWeeks,
    taxSettings: appSettings.taxSettings,
    taxAdjustments: appSettings.taxAdjustments ?? [],
    confirmedTaxPeriods: appSettings.confirmedTaxPeriods ?? []
  } as AppData;
};
