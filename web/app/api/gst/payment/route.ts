import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({id:z.string().uuid(),amount:z.number().finite().positive().nullable().optional(),reference:z.string().trim().max(120).nullable().optional()}).strict();

export async function POST(request:Request){
  try{
    await requireRole("manager");
    const parsed=schema.safeParse(await readJson(request));
    if(!parsed.success)throw new DishaApiError("Choose an unpaid GST record and enter a valid payment amount.",400);
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("disha_record_tax_payment",{p_id:parsed.data.id,p_amount:parsed.data.amount??null,p_reference:parsed.data.reference??null});
    if(error)throw new DishaApiError("GST payment record could not be updated.",error.code==="42501"?403:400);
    return NextResponse.json({obligation:data},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
