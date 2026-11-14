import { NextResponse } from "next/server";
import { AgentDispatchClient, SipClient } from "livekit-server-sdk";
import { z } from "zod";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  try{
    await requireRole("manager");const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new DishaApiError("Order draft not found.",404);
    const supabase=await createClient();
    if(process.env.LIVEKIT_MODE?.trim().toLowerCase()!=="live"){
      const {data,error}=await supabase.rpc("disha_log_supplier_call_stub",{p_order:id});
      if(error||!data)throw new DishaApiError("The demo call stub needs migration 120 and an approved order with a supplier phone.",error?.code==="42501"?403:503);
      return NextResponse.json({status:"demo_stub",contacted:false,order:data},{headers:{"Cache-Control":"no-store"}});
    }
    const url=process.env.LIVEKIT_URL?.trim();const key=process.env.LIVEKIT_API_KEY?.trim();const secret=process.env.LIVEKIT_API_SECRET?.trim();const trunk=process.env.LIVEKIT_SIP_TRUNK_ID?.trim();
    if(!url||!key||!secret||!trunk)throw new DishaApiError("Supplier calling needs LIVEKIT_URL, API key, API secret and a configured outbound SIP trunk.",503);
    const {data,error}=await supabase.rpc("disha_start_supplier_call",{p_order:id});
    if(error||!data||typeof data!=="object")throw new DishaApiError("Only a reviewed and approved draft with a supplier phone can be called.",400);
    const payload=data as {order?:{id:string;supplier_name:string;supplier_phone:string;order_total:number};lines?:Array<{item_name:string;quantity:number;unit:string;unit_price:number;line_total:number}>};
    const order=payload.order;const lines=payload.lines??[];if(!order?.supplier_phone||!lines.length)throw new DishaApiError("The approved order has no dialable supplier or items.",400);
    const apiUrl=url.replace(/^wss:/,"https:").replace(/^ws:/,"http:");
    const roomName=`disha-order-${order.id}`;const agentName=process.env.LIVEKIT_AGENT_NAME?.trim()||"disha-supplier-caller";
    try{
      const dispatch=new AgentDispatchClient(apiUrl,key,secret);const sip=new SipClient(apiUrl,key,secret);
      await dispatch.createDispatch(roomName,agentName,{metadata:JSON.stringify({orderId:order.id,supplierName:order.supplier_name,orderTotal:Number(order.order_total),lines})});
      await sip.createSipParticipant(trunk,order.supplier_phone,roomName,{participantIdentity:`supplier-${order.id}`,participantName:order.supplier_name,participantMetadata:JSON.stringify({orderId:order.id}),waitUntilAnswered:true,timeout:45,maxCallDuration:240});
    }catch(cause){console.error("LiveKit supplier dial failed",cause instanceof Error?cause.message:"unknown");await supabase.rpc("disha_record_supplier_call",{p_order:id,p_result:"cancelled",p_confirmation:"Call could not be established."});throw new DishaApiError("LiveKit could not place the supplier call. Check the SIP trunk and agent worker.",502);}
    return NextResponse.json({room:roomName,status:"calling"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiErrorResponse(error);}
}
