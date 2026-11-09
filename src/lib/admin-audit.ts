import { getAdminAuthClientKey } from "@/lib/admin-session";
import { recordAdminAuthAuditEvent } from "@/lib/db";

/** Best-effort audit trail containing only a bounded event, hashed client key, and result. */
export async function auditAdminAuthEvent(
  request: Request,
  eventType: string,
  success: boolean,
): Promise<void> {
  try {
    const actorKey = getAdminAuthClientKey(request, process.env.ADMIN_AUTH_PEPPER);
    await recordAdminAuthAuditEvent(eventType, actorKey, success);
  } catch {
    // Authentication must fail closed on auth checks, but audit storage outages
    // should not expose secrets or turn a successful MFA action into a retry hazard.
  }
}
