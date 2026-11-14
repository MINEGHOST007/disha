import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({state:z.string().trim().min(2).max(80),district:z.string().trim().min(2).max(100),festival_name:z.string().trim().min(2).max(100),event_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),uplift_percent:z.number().finite().min(0).max(200)}).strict();

export async function POST(request:Request){
  try{
    await requireRole("manager");
    const parsed=schema.safeParse(await readJson(request));
    if(!parsed.success)throw new DishaApiError("Enter the store state, district, event name, date and a 0–200% merchant estimate.",400);
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("disha_save_seasonal_order_scenario",{
      p_state:parsed.data.state,p_district:parsed.data.district,p_festival:parsed.data.festival_name,
      p_event_date:parsed.data.event_date,p_uplift_percent:parsed.data.uplift_percent,
    });
    if(error)throw new DishaApiError("Regional festival scenario could not be saved. Apply migration 124 and retry.",error.code==="42501"?403:400);
    return NextResponse.json({scenario:data},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
