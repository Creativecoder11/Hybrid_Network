import "server-only";
import { cache } from "react";
import { connectDB } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import type { TerminalRecord } from "@/lib/terminals/types";

// Super Admin feature controls (Admin -> Settings -> Customer Portal
// Features). Enforced on the server: location data is stripped from device
// records before they reach any customer page or export, and tracking
// requests are rejected, so hiding a menu item is never the only protection.

export type FeatureFlags = {
  /** Customers may see device location (coordinates, maps). */
  deviceLocation: boolean;
  /** Customers may use the Tracking page / location history. Requires deviceLocation. */
  tracking: boolean;
};

export const getFeatureFlags = cache(async (): Promise<FeatureFlags> => {
  await connectDB();
  const settings = await Settings.findOne({ key: "GLOBAL" }).select("featureDeviceLocation featureTracking").lean();
  const deviceLocation = settings?.featureDeviceLocation !== false;
  return {
    deviceLocation,
    tracking: deviceLocation && settings?.featureTracking !== false,
  };
});

/** Removes location data from a terminal record when the customer may not see it. */
export function applyLocationPolicy(terminal: TerminalRecord, features: FeatureFlags): TerminalRecord {
  if (features.deviceLocation) return terminal;
  return { ...terminal, location: null, locationHistory: [] };
}
