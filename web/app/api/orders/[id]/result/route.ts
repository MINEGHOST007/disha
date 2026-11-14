import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { supplierCallResultSchema } from "@/lib/merchant/supplier-call-result";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{await requireRole("manager");const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new DishaApiError("Order not found.",404);const parsed=supplierCallResultSchema.safeParse(await readJson(request));if(!parsed.success)throw new DishaApiError("Record what the seller said before choosing this outcome.",400);const supabase=await createClient();const {data,error}=await supabase.rpc("disha_record_supplier_call",{p_order:id,p_result:parsed.data.result,p_confirmation:parsed.data.confirmation});if(error)throw new DishaApiError("Call result could not be recorded. The order may no longer be awaiting review.",400);return NextResponse.json({order:data},{headers:{"Cache-Control":"no-store"}});}catch(error){return apiErrorResponse(error);}
}
