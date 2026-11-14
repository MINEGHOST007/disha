import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  try{await requireRole("manager");const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new DishaApiError("Order draft not found.",404);const supabase=await createClient();const {data,error}=await supabase.rpc("disha_approve_order",{p_order:id});if(error)throw new DishaApiError("Order could not be approved. Check that it is still a draft.",400);return NextResponse.json({order:data},{headers:{"Cache-Control":"no-store"}});}catch(error){return apiErrorResponse(error);}
}
