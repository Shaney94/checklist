const {getClient,accountUser,email,ORIGIN}=require('./account.cjs');
async function deliverInvitation(address,sdk=getClient()){
 // Only an exact login lookup; never expose provider records to the Host.
 const existing=await sdk.management.user.load(address);
 if(!existing.ok&&existing.code!==404)throw Error('Invitation unavailable');
 if(existing.ok&&(email(existing.data?.email)!==address||existing.data.status==='disabled'||!['cleaner','roleless'].includes(accountUser(existing.data).authorizationState)))throw Error('Invitation unavailable');
 const result=await sdk.magicLink.signUpOrIn.email(address,new URL('/?join=1',ORIGIN).href);
 // No password, tenant membership, roles or verified-email claims are assigned.
 if(!result.ok)throw Error('Invitation unavailable');
}
module.exports={deliverInvitation};
