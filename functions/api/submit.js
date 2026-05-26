/**
 * ============================================================================
 *  Annual Self-Reflection Form — Cloudflare Pages Function
 *  Path: /api/submit  (handled by functions/api/submit.js)
 * ============================================================================
 *
 *  WHAT THIS FILE DOES
 *  - Accepts POST requests with the form's JSON body
 *  - Validates required fields
 *  - Sends a formatted HTML email to management via the Resend REST API
 *  - Returns JSON { ok: true } on success, or { error: "..." } on failure
 *
 *  ENVIRONMENT VARIABLES (set in Cloudflare Pages → Settings → Environment variables)
 *  - RESEND_API_KEY    Required. Your Resend API key (starts with "re_").
 *
 *  TO CHANGE THE SENDER ADDRESS LATER
 *  - Once wellbeing365.com.au is verified in Resend, change FROM_EMAIL below
 *    from "Wellbeing Reviews <onboarding@resend.dev>" to
 *    "Wellbeing Reviews <reviews@wellbeing365.com.au>".
 * ============================================================================
 */

// ----- Config ---------------------------------------------------------------
const FROM_EMAIL        = 'Wellbeing Reviews <onboarding@resend.dev>';
const MANAGEMENT_EMAILS = ['darbystuddert@wellbeing365.com.au'];
const CLINIC_NAME       = 'Wellbeing Chiropractic';

// ----- Helpers --------------------------------------------------------------
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Build the HTML email body sent to management.
 * Mirrors the visual style of the form for consistency.
 */
function buildEmailHtml(data) {
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px;background:#F6F4EF;border-radius:8px 0 0 8px;font-size:13px;color:#6A7878;width:170px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;background:#FFFFFF;border:1px solid #E4E1DA;border-left:0;border-radius:0 8px 8px 0;font-size:14px;color:#2C3A3A;white-space:pre-wrap;">${escapeHtml(value) || '<em style="color:#A5ADA9;">—</em>'}</td>
    </tr>`;

  const qa = (n, q, a) => `
    <div style="margin:0 0 18px;padding:18px;background:#FFFFFF;border:1px solid #E4E1DA;border-radius:12px;">
      <div style="display:inline-block;background:#E8F0EB;color:#5E7E6B;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;margin-bottom:8px;">Question ${n}</div>
      <div style="font-size:14px;font-weight:600;color:#2C3A3A;margin-bottom:8px;line-height:1.5;">${escapeHtml(q)}</div>
      <div style="font-size:14px;color:#2C3A3A;line-height:1.65;white-space:pre-wrap;">${escapeHtml(a) || '<em style="color:#A5ADA9;">No response</em>'}</div>
    </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F6F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C3A3A;">
  <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#6A7878;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(CLINIC_NAME)}</div>
      <h1 style="font-size:22px;margin:6px 0 4px;color:#2C3A3A;font-weight:600;">Annual Self-Reflection Submission</h1>
      <div style="font-size:13px;color:#6A7878;">Part A — Employee Self-Reflection</div>
    </div>

    <div style="background:#FFFFFF;border:1px solid #E4E1DA;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:separate;border-spacing:0 6px;">
        ${row('Employee Name', data.employeeName)}
        ${row('Manager Name',  data.managerName)}
        ${row('Date',          data.reviewDate)}
      </table>
    </div>

    <h2 style="font-size:16px;margin:0 0 14px;color:#2C3A3A;font-weight:600;">Part A — Self Reflection</h2>
    ${qa(1, 'What are you enjoying most about your role?', data.q1)}
    ${qa(2, 'What are you not enjoying about your role?', data.q2)}
    ${qa(3, 'What is a patient interaction you had this year that is memorable or that you\u2019re most fond of?', data.q3)}
    ${qa(4, 'Describe a challenging patient situation you faced this year. What did you learn from it?', data.q4)}
    ${qa(5, 'What management support would help you perform at your best in the next 12 months?', data.q5)}

    <h2 style="font-size:16px;margin:24px 0 14px;color:#2C3A3A;font-weight:600;">Additional Comments</h2>
    <div style="background:#FFFFFF;border:1px solid #E4E1DA;border-radius:12px;padding:18px;font-size:14px;line-height:1.65;white-space:pre-wrap;">
      ${escapeHtml(data.additionalComments) || '<em style="color:#A5ADA9;">No additional comments</em>'}
    </div>

    <div style="margin-top:24px;padding:18px;background:#E8F0EB;border-radius:12px;font-size:13px;color:#3F5B4C;">
      <strong>Acknowledgment:</strong> Submission signed by
      <strong>${escapeHtml(data.signature)}</strong> on ${escapeHtml(data.signatureDate)}.
    </div>

    <div style="text-align:center;font-size:11px;color:#A5ADA9;margin-top:24px;letter-spacing:0.04em;">
      Submitted ${escapeHtml(new Date().toISOString())}
    </div>
  </div>
</body></html>`;
}

// ----- Route handler --------------------------------------------------------
export async function onRequestPost(context) {
  const { request, env } = context;

  // ---- Parse JSON body ----
  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  // ---- Validate required fields ----
  const required = [
    'employeeName', 'managerName', 'reviewDate',
    'q1', 'q2', 'q3', 'q4', 'q5',
    'signature', 'signatureDate', 'ack',
  ];
  const missing = required.filter(
    (k) => body[k] === undefined || body[k] === null || String(body[k]).trim() === ''
  );
  if (missing.length) {
    return jsonResponse({ error: 'Please complete all required fields.' }, 400);
  }

  // ---- Check API key ----
  if (!env || !env.RESEND_API_KEY) {
    return jsonResponse(
      { error: 'Email service is not configured. Please contact your administrator.' },
      500
    );
  }

  // ---- Build email ----
  const html    = buildEmailHtml(body);
  const subject = `Annual Review Submission \u2014 ${String(body.employeeName).slice(0, 120)}`;

  // ---- Send via Resend REST API ----
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: MANAGEMENT_EMAILS,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      let detail = '';
      try {
        const errBody = await resendRes.json();
        detail = errBody && (errBody.message || errBody.error || JSON.stringify(errBody));
      } catch (_e) {
        detail = await resendRes.text().catch(() => '');
      }
      console.error('Resend send failed:', resendRes.status, detail);
      return jsonResponse(
        { error: 'We could not deliver the submission. Please try again or contact your manager.' },
        502
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Submission error:', err);
    return jsonResponse(
      { error: 'We could not deliver the submission. Please try again or contact your manager.' },
      500
    );
  }
}

// Optional: reject non-POST methods cleanly so the same path doesn't 404 oddly.
export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { 'Allow': 'POST', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
