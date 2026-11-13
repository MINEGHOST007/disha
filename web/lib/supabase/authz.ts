import { createClient } from "@/lib/supabase/server";

export type MerchantRole = "owner" | "manager" | "staff";
const rank: Record<MerchantRole, number> = { staff: 1, manager: 2, owner: 3 };

export async function requireRole(minimum: MerchantRole = "staff") {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("AUTH_REQUIRED");
  const { data: memberships, error } = await supabase.from("disha_merchant_members").select("merchant_id, role").eq("user_id", user.id);
  if (error || !memberships?.length) throw new Error("MERCHANT_ACCESS_REQUIRED");
  const membership = memberships.find((item) => rank[item.role as MerchantRole] >= rank[minimum]);
  if (!membership) throw new Error("INSUFFICIENT_ROLE");
  return { userId: user.id, merchantId: membership.merchant_id as string, role: membership.role as MerchantRole };
}
