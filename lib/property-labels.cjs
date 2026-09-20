// Only pass already-authorised, non-sensitive identity fields here. Never derive
// a label from a postal address, contact number, access notes or email address.
function propertyLabels(properties){
 const result={};const groups=new Map();
 for(const p of properties){const name=p.name.trim()||'Property';const key=name.toLocaleLowerCase('en-GB');if(!groups.has(key))groups.set(key,[]);if(!groups.get(key).some(x=>x.id===p.id))groups.get(key).push({...p,name});}
 for(const group of groups.values())for(const p of group){
  let label=p.name;
  if(group.length>1){
   const customer=p.customerFirstName?.trim(),unit=p.unitLabel?.trim();
   if(customer&&group.filter(x=>x.customerFirstName?.trim()===customer).length===1)label+=' · '+customer;
   else if(unit&&group.filter(x=>x.unitLabel?.trim()===unit).length===1)label+=' · '+unit;
   else {let n=4;while(n<p.id.length&&group.some(x=>x.id!==p.id&&x.id.slice(-n)===p.id.slice(-n)))n++;label+=' · Property '+p.id.slice(-n);}
  }
  result[p.id]=label;
 }
 return result;
}
module.exports={propertyLabels};
