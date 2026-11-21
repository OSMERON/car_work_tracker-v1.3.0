import type { VehicleType } from "../types";

export function VehiclePlate({ registration, vehicleType, compact = false }: { registration: string; vehicleType?: VehicleType; compact?: boolean }) {
  return <span className={`vehicle-plate ${vehicleType === "electric" ? "electric" : ""} ${compact ? "compact" : ""}`.trim()}>{registration || "NO REG"}</span>;
}
