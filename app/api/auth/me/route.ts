import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, names, SessionExpiredError } from '@/lib/auth';
export async function GET(){
  const jar=await cookies();
  const token=jar.get(names.access)?.value;
  if(!token)return NextResponse.json({user:null,error:'Sign in to continue.'},{status:401});
  try{return NextResponse.json({user:await currentUser(token)});}
  catch(error){
    if(error instanceof SessionExpiredError){
      const response=NextResponse.json({user:null,error:'Your session expired. Sign in again.'},{status:401});
      response.cookies.delete(names.access);
      response.cookies.delete(names.refresh);
      return response;
    }
    return NextResponse.json({user:null,error:'Could not check your session.'},{status:503});
  }
}
