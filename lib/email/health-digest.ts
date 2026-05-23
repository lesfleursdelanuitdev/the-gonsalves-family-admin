import { Resend } from "resend";
import type { CheckResult } from "../health/types";

const OWNER_EMAIL = "the.gonsalves.family.tree@gmail.com";
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? "The Gonsalves Family <hello@mail.gonsalvesfamily.com>";

let _client: Resend | null = null;
function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _client = new Resend(key);
  }
  return _client;
}

const CATEGORY_LABELS: Record<string, string> = {
  media: "Media",
  data_integrity: "Data Integrity",
  community: "Community",
  user_hygiene: "User Hygiene",
};

export async function sendHealthDigest(results: CheckResult[], ranAt: Date) {
  const issues = results.filter((r) => r.count > 0);
  const totalIssues = issues.reduce((s, r) => s + r.count, 0);

  const statusLine =
    totalIssues === 0
      ? "✅ No issues found — everything looks healthy."
      : `⚠️ ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found across ${issues.length} check${issues.length !== 1 ? "s" : ""}.`;

  const groupedRows = issues.reduce<Record<string, CheckResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const sectionsHtml = Object.entries(groupedRows)
    .map(([cat, rows]) => {
      const rowsHtml = rows
        .map(
          (r) =>
            `<tr>
              <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${r.label}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#dc2626;font-weight:600">${r.count}</td>
            </tr>`,
        )
        .join("");
      return `
        <h3 style="margin:20px 0 8px;color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:0.05em">${CATEGORY_LABELS[cat] ?? cat}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:6px 12px;text-align:left;font-weight:600">Check</th>
              <th style="padding:6px 12px;text-align:right;font-weight:600">Issues</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
      <h1 style="font-size:22px;margin-bottom:4px">Weekly Site Health Report</h1>
      <p style="color:#6b7280;margin-top:0;font-size:13px">
        Run on ${ranAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
      <p style="font-size:15px;margin:16px 0">${statusLine}</p>
      ${sectionsHtml || ""}
      <p style="margin-top:28px">
        <a href="${process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin.gonsalvesfamily.com"}/admin/site-health"
           style="background:#16a34a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">
          View full report →
        </a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">
        You are receiving this because you are the site owner. This report runs automatically every week.
      </p>
    </body>
    </html>`;

  const subject =
    totalIssues === 0
      ? "✅ Weekly Site Health: All clear"
      : `⚠️ Weekly Site Health: ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found`;

  const { error } = await getClient().emails.send({
    from: FROM_ADDRESS,
    to: OWNER_EMAIL,
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
