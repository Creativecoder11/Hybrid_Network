import "dotenv/config";
import nodemailer from "nodemailer";

async function verifySmtp() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  console.log("--- SMTP Configuration Check ---");
  console.log("SMTP_HOST:", SMTP_HOST || "(not set)");
  console.log("SMTP_PORT:", SMTP_PORT || "(not set)");
  console.log("SMTP_USER:", SMTP_USER ? `${SMTP_USER.slice(0, 3)}***@${SMTP_USER.split('@')[1] || 'domain'}` : "(not set)");
  console.log("SMTP_PASS:", SMTP_PASS ? "[SET, length=" + SMTP_PASS.length + "]" : "(not set)");
  console.log("EMAIL_FROM:", EMAIL_FROM || "(not set)");

  if (!SMTP_HOST) {
    console.error("\n❌ Error: SMTP_HOST is not defined in .env file.");
    process.exit(1);
  }

  const port = Number(SMTP_PORT) || 587;
  const isSecure = port === 465;

  console.log(`\nAttempting connection to ${SMTP_HOST}:${port} (secure=${isSecure})...`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    secure: isSecure,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    // Add reasonable timeout for verification
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    const success = await transporter.verify();
    if (success) {
      console.log("\n✅ SMTP Connection Verified Successfully! The server is ready to send emails.");
    } else {
      console.log("\n⚠️ SMTP verify returned false.");
    }
  } catch (error: any) {
    console.error("\n❌ SMTP Connection Failed:");
    console.error("Message:", error?.message || error);
    console.error("Code:", error?.code);
    console.error("Response:", error?.response);
    process.exit(1);
  }
}

verifySmtp();

