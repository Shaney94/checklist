const {getClient,accountUser,email}=require('./account.cjs');

// Called only after matching a live property invitation to the authenticated user.
// Never use the compatibility role to prove that explicit provisioning succeeded.
async function provisionInvitedCleaner(user,sdk=getClient()){
 const inspect=async()=>{
  const result=await sdk.management.user.loadByUserId(user.id),u=result.data;
  if(!result.ok||!u||u.userId!==user.id||!email(u.email)||email(u.email)!==email(user.email)||u.verifiedEmail!==true||u.status==='disabled')throw Error('Setup incomplete');
  const account=accountUser(u);
  if(account.workspaceId!==user.workspaceId)throw Error('Setup incomplete');
  // Do not modify Host/unknown/conflicting Turnli roles, even in another scope.
  const lists=[u.roleNames,...(u.userTenants||[]).map(t=>t.roleNames)];
  if(lists.some(list=>list!==undefined&&(!Array.isArray(list)||list.some(r=>typeof r!=='string'||(r.startsWith('turnli-')&&r!=='turnli-cleaner')))))throw Error('Setup incomplete');
  const tenant=account.legacyAccess?process.env.TURNLI_TENANT_ID:undefined;
  if(account.legacyAccess&&(!tenant||!u.userTenants?.some(t=>t.tenantId===tenant)))throw Error('Setup incomplete');
  const roles=tenant?u.userTenants.find(t=>t.tenantId===tenant).roleNames:u.roleNames;
  return {tenant,explicit:roles?.includes('turnli-cleaner')===true,account};
 };
 const before=await inspect();
 if(!before.explicit){
  const result=before.tenant
   ?await sdk.management.user.addTenantRoles(user.id,before.tenant,['turnli-cleaner'])
   :await sdk.management.user.addRoles(user.id,['turnli-cleaner']);
  if(!result.ok)throw Error('Setup incomplete');
 }
 const after=await inspect();
 if(after.tenant!==before.tenant||!after.explicit||after.account.role!=='cleaner')throw Error('Setup incomplete');
}
module.exports={provisionInvitedCleaner};
