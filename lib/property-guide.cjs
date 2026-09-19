const guideFields={
 access:'Access instructions',equipment:'Equipment locations',appliances:'Appliance instructions',
 smartHome:'Smart-home / Tapo instructions',lockUp:'Lock-up procedure',other:'Other cleaner guidance',
};
const fields=Object.keys(guideFields);
function validateGuide(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.includes(k)))throw Error('Invalid guide');
 const guide={};
 for(const key of fields){if(typeof value[key]!=='string'||value[key].length>5000)throw Error('Invalid guide');guide[key]=value[key].trim();}
 return guide;
}
module.exports={validateGuide,guideFields};
