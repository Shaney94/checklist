const categories={damage:'Damage or missing item',maintenance:'Maintenance',supplies:'Low supplies',access:'Access problem',other:'Other'};
function validateIssue(body){
 if(!Object.hasOwn(categories,body.category)||typeof body.description!=='string'||!body.description.trim()||body.description.length>2000)throw Error('Invalid issue');
 return {category:body.category,description:body.description.trim()};
}
module.exports={categories,validateIssue};
