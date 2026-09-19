const {getClient,accountUser,email}=require('./account.cjs');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const code=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<='2100-12-31'&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
async function eligibleCleaner(id,sdk=getClient()){
 const result=await sdk.management.user.loadByUserId(id);
 if(!result.ok){if(result.code===404)return false;throw Error('Identity provider unavailable');}
 const user=result.data;
 return user?.userId===id&&user.verifiedEmail===true&&!!email(user.email)&&user.status!=='disabled'&&accountUser(user).role==='cleaner';
}
module.exports={uuid,code,date,eligibleCleaner};
