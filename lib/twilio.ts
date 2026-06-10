import twilio from "twilio";

/** Send an SMS via Twilio */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio credentials not configured; SMS skipped");
    return false;
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({ to, from, body });
    return true;
  } catch (error) {
    console.error("Twilio SMS error:", error);
    return false;
  }
}
