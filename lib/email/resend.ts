import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _client = new Resend(key);
  }
  return _client;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? "The Gonsalves Family <hello@mail.gonsalvesfamily.com>";

export async function sendContactReply({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const { data, error } = await getClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: body,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}
