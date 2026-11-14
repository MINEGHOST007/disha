import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const line=z.object({item_name:z.string().trim().min(1).max(120),quantity:z.number().finite().positive().max(1_000_000),unit:z.string().trim().min(1).max(24),unit_price:z.number().finite().min(0).max(1_000_000_000)}).strict();
const schema=z.object({supplier_name:z.string().trim().min(1).max(120),supplier_phone:z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable().optional(),order_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),lines:z.array(line).min(1).max(200)}).strict();
export async function POST(request:Request){
  try{
    await requireRole("manager");const parsed=schema.safeParse(await readJson(request));
    if(!parsed.success)throw new DishaApiError("Check the supplier details, phone number and order lines.",400);
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("disha_save_order_draft",{p_supplier:parsed.data.supplier_name,p_phone:parsed.data.supplier_phone??null,p_order_date:parsed.data.order_date??null,p_lines:parsed.data.lines as unknown as Json,p_approve:false});
    if(error)throw new DishaApiError("Order draft could not be saved. Apply the latest Disha migration and retry.",error.code==="42501"?403:503);
    return NextResponse.json({id:data,status:"draft"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
