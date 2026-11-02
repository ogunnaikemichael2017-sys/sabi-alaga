// TEMPORARY DIAGNOSTIC (remove before merge): compares raw send vs template send
// on both Zoho hosts with the account's real API key. Returns full HTTP results.
const KEY = process.env.ZEPTO_API_KEY;
const FROM = process.env.SENDER_EMAIL || "noreply@sabialaga.name.ng";
const TO_EMAIL = process.env.MAILTEST_TO || "ogunnaikemichael2017@gmail.com";

async function post(host, path, body) {
  const url = `https://${host}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return {
      url,
      status: res.status,
      ms: Date.now() - started,
      contentType: res.headers.get("content-type"),
      requestId: res.headers.get("x-request-id") || res.headers.get("x-zoho-request-id"),
      body: text.slice(0, 600),
    };
  } catch (e) {
    return { url, ms: Date.now() - started, error: String((e && e.message) || e) };
  }
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 200, body: JSON.stringify({ error: "ZEPTO_API_KEY missing" }) };
  const to = [{ email_address: { address: TO_EMAIL, name: "Michael" } }];
  const raw = {
    from: { address: FROM, name: "Sabi Alaga test" },
    to,
    subject: "Sabi Alaga raw API send test",
    htmlbody: "<p>If you can read this, raw API sends work.</p>",
  };
  const results = {
    key_preview: KEY.slice(0, 6) + "..." + KEY.slice(-4),
    empty_body: await post("api.zeptomail.com", "/v1.1/email", {}),
    bad_from: await post("api.zeptomail.com", "/v1.1/email", {
      from: { address: "noreply@definitely-not-a-verified-domain-9x8y.example", name: "x" },
      to,
      subject: "probe",
      htmlbody: "<p>probe</p>",
    }),
    raw_api_zeptomail: await post("api.zeptomail.com", "/v1.1/email", raw),
  };
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(results, null, 2),
  };
};
