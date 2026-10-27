import {NextRequest,NextResponse} from 'next/server';
import {userRequest} from '@/lib/actions';
import {currentUser} from '@/lib/auth';

export async function GET(){
 try{
  const user=await currentUser();
  const profiles=await userRequest(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  return NextResponse.json(profiles[0]||null);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Profile unavailable.'},{status:401});
 }
}

export async function PUT(request:NextRequest){
 try{
  const input=await request.json();
  const user=await currentUser();
  const profile={id:user.id,display_name:typeof input.display_name==='string'?input.display_name.slice(0,80):'',skin_type:typeof input.skin_type==='string'?input.skin_type.slice(0,40):'',skin_goals:Array.isArray(input.skin_goals)?input.skin_goals.filter((goal:unknown)=>typeof goal==='string').slice(0,12):[],budget:input.budget===''||input.budget==null?0:Number.isFinite(Number(input.budget))?Math.max(0,Number(input.budget)):0,currency:['USD','NGN','KES','GHS','ZAR','GBP'].includes(input.currency)?input.currency:'NGN'};
  const saved=await userRequest('/rest/v1/profiles?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(profile)});
  return NextResponse.json(saved[0]||profile);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Could not save profile.'},{status:401});
 }
}
