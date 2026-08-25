import "server-only";
import { starlinkFetch } from "./client";

// Typed wrappers for the Starlink WRITE passthrough
// (https://slash.stationone.io/passthrough-docs — also a client-only SPA;
// this catalog of 19 actions was recovered from its shipped JS bundle and
// cross-checked against the OpenAPI operation at GET/PUT/POST/DELETE/PATCH
// /starlink/{api_name}, whose body is models.PassthroughRequest).
//
// Nothing in the app's UI calls these yet — commands stay local-only
// (lib/terminals/service.ts) until write actions are explicitly wired up.
// `update_product_post` from the catalog is intentionally omitted: the API
// itself documents it as deprecated in favor of `updateProduct` below.

export type PassthroughApiName =
  | "remove_router_config"
  | "set_router_config"
  | "update_router_config"
  | "reboot_router"
  | "create_service_line"
  | "deactivate_service_line"
  | "set_recurring_blocks"
  | "add_topup_data"
  | "update_service_line_nickname"
  | "update_product_put"
  | "service_line_opt_in"
  | "service_line_opt_out"
  | "set_public_ip"
  | "create_terminal"
  | "reboot_user_terminal"
  | "add_terminal_to_service_line"
  | "remove_terminal_from_service_line"
  | "create_address";

type HttpMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH";

type PassthroughRequestBody = {
  path_params?: Record<string, string>;
  query_params?: Record<string, string | number | boolean>;
  data?: Record<string, unknown>;
  device_id?: string;
  config_id?: string;
  router_id?: string;
};

export type PassthroughResponse = {
  api_name: string;
  data?: Record<string, unknown>;
  endpoint: string;
  message: string;
  method: string;
  status: string;
  status_code: number;
};

export async function callPassthrough(
  apiName: PassthroughApiName,
  method: HttpMethod,
  body: PassthroughRequestBody
): Promise<PassthroughResponse> {
  return starlinkFetch<PassthroughResponse>(`/starlink/${encodeURIComponent(apiName)}`, { method, body });
}

export function removeRouterConfig(args: { vesselId: string; routerId: string }) {
  return callPassthrough("remove_router_config", "DELETE", {
    path_params: { vessel_id: args.vesselId },
    router_id: args.routerId,
  });
}

export function setRouterConfig(args: { vesselId: string; routerId: string; configId: string }) {
  return callPassthrough("set_router_config", "PUT", {
    path_params: { vessel_id: args.vesselId },
    router_id: args.routerId,
    config_id: args.configId,
  });
}

export function updateRouterConfig(args: {
  vesselId: string;
  configId: string;
  nickname?: string;
  routerConfigJson?: string;
}) {
  return callPassthrough("update_router_config", "PUT", {
    path_params: { vessel_id: args.vesselId },
    config_id: args.configId,
    data: { nickname: args.nickname, routerConfigJson: args.routerConfigJson },
  });
}

export function rebootRouter(args: { vesselId: string; routerId: string }) {
  return callPassthrough("reboot_router", "POST", {
    path_params: { vessel_id: args.vesselId },
    router_id: args.routerId,
  });
}

export function createServiceLine(args: {
  accountNumber: string;
  addressReferenceId: string;
  productReferenceId: string;
  vesselName?: string;
}) {
  return callPassthrough("create_service_line", "POST", {
    path_params: { account_number: args.accountNumber },
    data: {
      vessel_name: args.vesselName,
      addressReferenceId: args.addressReferenceId,
      productReferenceId: args.productReferenceId,
    },
  });
}

export function deactivateServiceLine(args: {
  accountNumber: string;
  serviceLineNumber: string;
  endNow?: boolean;
  reasonForCancellation?: string;
}) {
  return callPassthrough("deactivate_service_line", "DELETE", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
    query_params: {
      ...(args.endNow !== undefined ? { endNow: args.endNow } : {}),
      ...(args.reasonForCancellation ? { reasonForCancellation: args.reasonForCancellation } : {}),
    },
  });
}

export function setRecurringBlocks(args: {
  vesselId: string;
  recurringDataBlocks: { productId: string; count: number }[];
}) {
  return callPassthrough("set_recurring_blocks", "PUT", {
    path_params: { vessel_id: args.vesselId },
    data: { recurringDataBlocks: args.recurringDataBlocks },
  });
}

export function addTopupData(args: { vesselId: string; productId: string; count: number }) {
  return callPassthrough("add_topup_data", "POST", {
    path_params: { vessel_id: args.vesselId },
    data: { productId: args.productId, count: args.count },
  });
}

export function updateServiceLineNickname(args: { vesselId: string; nickname: string }) {
  return callPassthrough("update_service_line_nickname", "PUT", {
    path_params: { vessel_id: args.vesselId },
    data: { nickname: args.nickname },
  });
}

export function updateProduct(args: {
  vesselId: string;
  productReferenceId: string;
  recurringDataBlocks?: { productId: string; count: number }[];
  delayUpdate?: boolean | null;
}) {
  return callPassthrough("update_product_put", "PUT", {
    path_params: { vessel_id: args.vesselId, product_reference_id: args.productReferenceId },
    data: {
      recurringDataBlocks: args.recurringDataBlocks,
      delayUpdate: args.delayUpdate,
    },
  });
}

export function serviceLineOptIn(args: { accountNumber: string; serviceLineNumber: string }) {
  return callPassthrough("service_line_opt_in", "POST", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
  });
}

export function serviceLineOptOut(args: { accountNumber: string; serviceLineNumber: string }) {
  return callPassthrough("service_line_opt_out", "DELETE", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
  });
}

export function setPublicIp(args: { accountNumber: string; serviceLineNumber: string; publicIp: boolean }) {
  return callPassthrough("set_public_ip", "PUT", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
    data: { publicIp: args.publicIp },
  });
}

export function createTerminal(args: { accountNumber: string; deviceId: string }) {
  return callPassthrough("create_terminal", "POST", {
    path_params: { account_number: args.accountNumber },
    device_id: args.deviceId,
  });
}

export function rebootUserTerminal(args: { vesselId: string; deviceId: string }) {
  return callPassthrough("reboot_user_terminal", "POST", {
    path_params: { vessel_id: args.vesselId },
    device_id: args.deviceId,
  });
}

export function addTerminalToServiceLine(args: {
  accountNumber: string;
  serviceLineNumber: string;
  deviceId: string;
}) {
  return callPassthrough("add_terminal_to_service_line", "POST", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
    device_id: args.deviceId,
  });
}

export function removeTerminalFromServiceLine(args: {
  accountNumber: string;
  serviceLineNumber: string;
  deviceId: string;
}) {
  return callPassthrough("remove_terminal_from_service_line", "DELETE", {
    path_params: { account_number: args.accountNumber, service_line_number: args.serviceLineNumber },
    device_id: args.deviceId,
  });
}

export function createAddress(args: {
  accountNumber: string;
  addressLines: string[];
  administrativeAreaCode: string;
  regionCode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string;
  administrativeArea?: string;
  region?: string;
  postalCode?: string;
}) {
  return callPassthrough("create_address", "POST", {
    path_params: { account_number: args.accountNumber },
    data: {
      addressLines: args.addressLines,
      administrativeAreaCode: args.administrativeAreaCode,
      regionCode: args.regionCode,
      formattedAddress: args.formattedAddress,
      latitude: args.latitude,
      longitude: args.longitude,
      locality: args.locality,
      administrativeArea: args.administrativeArea,
      region: args.region,
      postalCode: args.postalCode,
    },
  });
}
