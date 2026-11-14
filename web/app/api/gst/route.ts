import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({tax_period:z.string().trim().min(1).max(32),amount:z.number().finite().positive().max(100_000_000),due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),note:z.string().trim().max(300).nullable().optional()}).strict();

export async function POST(request:Request){
  try{
    await requireRole("manager");
    const parsed=schema.safeParse(await readJson(request));
    if(!parsed.success)throw new DishaApiError("Enter a GST period, amount and due date.",400);
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("disha_create_tax_obligation",{p_period:parsed.data.tax_period,p_amount:parsed.data.amount,p_due:parsed.data.due_date,p_note:parsed.data.note??null});
    if(error)throw new DishaApiError(error.code==="23505"?"A GST record already exists for this period.":"GST due could not be saved. Apply migration 122 and retry.",error.code==="42501"?403:400);
    return NextResponse.json({id:data,status:"due"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
