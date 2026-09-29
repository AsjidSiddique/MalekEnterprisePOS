import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment gateway abstraction. The webhook route only talks to this interface, so adding Yoco later means
 * writing one class that verifies Yoco's signature and maps its events — nothing else changes.
 */
export interface PaymentEvent {
  type: "payment.succeeded" | "payment.failed";
  /** Gateway transaction id. Used for idempotency: the same reference is never processed twice. */
  reference: string;
  invoiceId: string;
  amount: number;
  currency: string;
}

export interface PaymentGateway {
  readonly name: string;
  /** Throws GatewayError if the signature is wrong or the payload can't be understood. */
  verifyAndParse(rawBody: string, headers: Headers): PaymentEvent;
}

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Test-mode gateway: events are signed with HMAC-SHA256 of the raw body using PAYMENT_WEBHOOK_SECRET. */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";
  constructor(private secret: string) {}

  verifyAndParse(rawBody: string, headers: Headers): PaymentEvent {
    const provided = headers.get("x-signature") ?? "";
    const expected = createHmac("sha256", this.secret).update(rawBody).digest("hex");
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new GatewayError(401, "Invalid signature.");
    let json: Partial<PaymentEvent>;
    try { json = JSON.parse(rawBody) as Partial<PaymentEvent>; } catch { throw new GatewayError(400, "Body must be JSON."); }
    if ((json.type !== "payment.succeeded" && json.type !== "payment.failed") || !json.reference || !json.invoiceId || typeof json.amount !== "number") {
      throw new GatewayError(400, "Unsupported or incomplete event.");
    }
    return { type: json.type, reference: String(json.reference), invoiceId: String(json.invoiceId), amount: json.amount, currency: json.currency ?? "ZAR" };
  }
}

export function getGateway(env: NodeJS.ProcessEnv = process.env): PaymentGateway {
  const provider = (env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (provider === "mock") {
    if (!env.PAYMENT_WEBHOOK_SECRET) throw new GatewayError(503, "PAYMENT_WEBHOOK_SECRET isn't set.");
    return new MockGateway(env.PAYMENT_WEBHOOK_SECRET);
  }
  if (provider === "yoco") throw new GatewayError(501, "The Yoco gateway hasn't been implemented yet. See docs/ARCHITECTURE.md.");
  throw new GatewayError(503, "No payment gateway is configured (PAYMENT_PROVIDER).");
}
