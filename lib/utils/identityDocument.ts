// The customer's identity document is one generic field (User.nidTradeLicense):
// a National ID number for an individual, or a Trade License number for a
// business or government customer. Only the label depends on Account Type.

export const IDENTITY_DOCUMENT_HELP =
  "Individual: the customer's National ID (NID) number. Business / Government: the organisation's Trade License number.";

export function identityDocumentLabel(accountType: string | null | undefined): string {
  if (accountType === "INDIVIDUAL") return "National ID (NID) Number";
  if (accountType === "BUSINESS_ENTERPRISE" || accountType === "GOVERNMENT") return "Trade License Number";
  return "NID / Trade License Number";
}
