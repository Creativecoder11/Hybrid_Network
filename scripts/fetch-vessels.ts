import "dotenv/config";

async function fetchVesselsFromApi() {
  const baseUrl = (
    process.env.SLASH_API_BASE_URL ||
    process.env.STARLINK_API_BASE_URL ||
    "https://slash-api.rudra.sh/api/v1"
  ).replace(/\/+$/, "");

  const apiKey = process.env.SLASH_API_KEY || process.env.API_URL;

  console.log("--- SLASH API Vessel Extractor ---");
  console.log("Base URL:", baseUrl);
  console.log("API Key configured:", apiKey ? `YES (length=${apiKey.length})` : "NO");

  if (!apiKey) {
    console.error("❌ Missing SLASH_API_KEY / API_URL in .env");
    process.exit(1);
  }

  const endpoint = `${baseUrl}/vessels?page=0&limit=100&includeInactive=true`;
  console.log(`\nFetching vessels from: ${endpoint}...`);

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error (${res.status}):`, errorText);
      process.exit(1);
    }

    const data = await res.json();
    console.log("\nRaw Response Keys:", Object.keys(data));

    const vessels = data.vessels || (Array.isArray(data) ? data : []);
    console.log(`\nFound ${vessels.length} vessel(s) (Total in API: ${data.totalCount ?? vessels.length}):\n`);

    if (vessels.length === 0) {
      console.log("⚠️ No vessels returned by the API.");
      return;
    }

    const summary = vessels.map((v: any, index: number) => {
      const termIds = Array.isArray(v.terminals)
        ? v.terminals.map((t: any) => t.terminalId || t.serialNumber || t.id).filter(Boolean).join(", ")
        : (v.terminalId || "N/A");

      return {
        Index: index + 1,
        "Vessel Name": v.vesselName || v.name || "Unnamed",
        "Vessel ID": v.vesselId || v.id || "N/A",
        "Account / Line": v.serviceLineNumber || v.accountNumber || "N/A",
        "Active State": v.active ?? v.status ?? "N/A",
        Terminals: termIds || "N/A",
      };
    });

    console.table(summary);

    console.log("\n--- Full JSON Listing of Vessels ---");
    console.log(JSON.stringify(vessels, null, 2));

  } catch (err: any) {
    console.error("❌ Network or API Fetch Error:", err?.message || err);
    process.exit(1);
  }
}

fetchVesselsFromApi();

