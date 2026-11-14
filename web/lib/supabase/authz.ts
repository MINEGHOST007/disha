import { DishaApiError } from "@/lib/disha/http";
import { createClient } from "@/lib/supabase/server";

export type MerchantRole = "owner" | "manager" | "staff";
export type WorkspaceContext = { userId: string; merchantId: string; role: MerchantRole };
const rank: Record<MerchantRole, number> = { staff: 1, manager: 2, owner: 3 };

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;
  const { data: membership, error } = await supabase
    .from("disha_merchant_members")
    .select("merchant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Supabase workspace membership query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "PGRST205") {
      throw new DishaApiError("Disha database schema is not installed. Run the base schema and migrations in Supabase before signing in.", 503);
    }
    throw new DishaApiError("Workspace access could not be checked.", 503);
  }
  if (!membership) return null;
  return { userId: user.id, merchantId: membership.merchant_id, role: membership.role as MerchantRole };
}

export async function requireRole(minimum: MerchantRole = "staff"): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!context) throw new DishaApiError("Sign in and create a merchant workspace to continue.", 401);
  const roleRank = rank[context.role];
  if (!roleRank || roleRank < rank[minimum]) throw new DishaApiError("Your workspace role does not allow this action.", 403);
  return context;
}
