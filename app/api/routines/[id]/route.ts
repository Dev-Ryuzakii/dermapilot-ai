import { NextResponse } from 'next/server';
import { userRequest } from '@/lib/actions';
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}) { try { const {id}=await params; if(!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:'Invalid routine id.'},{status:400}); await userRequest(`/rest/v1/skincare_routines?id=eq.${id}`,{method:'DELETE'}); return NextResponse.json({ok:true}); } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Unable to delete routine.'},{status:400}); } }
