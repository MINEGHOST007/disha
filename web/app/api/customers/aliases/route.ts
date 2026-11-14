import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse,DishaApiError,readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({customer_name:z.string().trim().min(1).max(120),alias:z.string().trim().min(1).max(120)}).strict();
export async function POST(request:Request){try{await requireRole("manager");const parsed=schema.safeParse(await readJson(request));if(!parsed.success)throw new DishaApiError("Enter the customer's canonical name and the alias used in transactions.",400);const supabase=await createClient();const {data,error}=await supabase.rpc("disha_save_customer_alias",{p_customer:parsed.data.customer_name,p_alias:parsed.data.alias});if(error)throw new DishaApiError("Customer alias could not be saved. Apply the latest Disha migration and retry.",error.code==="42501"?403:503);return NextResponse.json({id:data},{headers:{"Cache-Control":"no-store"}});}catch(error){return apiErrorResponse(error);}}
