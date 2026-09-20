// V1 business assumptions, NOT measured labour times, wages or marketplace fees.
// Tune centrally from observed work; version saved quotes when changing these.
const config = {
 version: 'v1', squareFootInMetres: 0.09290304,
 baseline: { area: 52, bedrooms: 2, beds: 2, bathrooms: 1 },
 regular: { minimum: 60, baseMinutes: 120, areaMinutes: 0.8, bathroomMinutes: 30, bedMinutes: 15, unknownBedroomMinutes: 12 },
 deep: { minimum: 130, baseMinutes: 255, areaMinutes: 2.8, bathroomMinutes: 60, bedMinutes: 25, unknownBedroomMinutes: 25 },
};
const limits = { bedrooms: [0,12], beds: [1,24], bathrooms: [1,12], size: [15,500], cleansPerMonth: [0,93] };
class QuoteInputError extends Error { constructor(field,message){super(message);this.field=field;} }
function fail(field,message){throw new QuoteInputError(field,message);}
function number(input,key,range,integer=true){const v=input[key];if(typeof v!=='number'||!Number.isFinite(v)||(integer&&!Number.isInteger(v))||v<range[0]||v>range[1])fail(key,`Enter ${key==='cleansPerMonth'?'cleans per month':key} between ${range[0]} and ${range[1]}.`);return v;}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('form','Check your property details.');
 if(Object.keys(input).some(k=>!['location','bedrooms','beds','bathrooms','sizeUnit','size','kind','cleansPerMonth'].includes(k)))fail('form','Send property details only; prices are calculated by Turnli.');
 if(typeof input.location!=='string'||input.location.trim().length<2||input.location.length>160||/[\x00-\x1f\x7f<>]/.test(input.location))fail('location','Enter a town, area or postcode (2–160 characters).');
 const bedrooms=number(input,'bedrooms',limits.bedrooms),beds=number(input,'beds',limits.beds),bathrooms=number(input,'bathrooms',limits.bathrooms);
 if(!['regular','deep','both'].includes(input.kind))fail('kind','Choose Regular, Deep or Both.');
 if(!['m2','ft2','unknown'].includes(input.sizeUnit))fail('sizeUnit','Choose square metres, square feet or I don’t know.');
 let size=null;
 if(input.sizeUnit==='unknown'){if(input.size!==null&&input.size!==undefined)fail('size','Leave size blank when it is unknown.');}
 else {
  size=number(input,'size',[0.01,10000],false);
  const metres=size*(input.sizeUnit==='ft2'?config.squareFootInMetres:1);
  if(metres<limits.size[0]||metres>limits.size[1])fail('size','Enter a size from 15 to 500 m² (approximately 162–5,381 ft²).');
 }
 const cleansPerMonth=input.cleansPerMonth==null?null:number(input,'cleansPerMonth',limits.cleansPerMonth);
 return {location:input.location.trim(),bedrooms,beds,bathrooms,sizeUnit:input.sizeUnit,size,kind:input.kind,cleansPerMonth};
}
function quote(input){
 const details=validate(input),base=config.baseline;
 // Unknown size uses a direct bedroom labour allowance, never an invented area.
 const area=details.sizeUnit==='unknown'?null:Math.round(details.size*(details.sizeUnit==='ft2'?config.squareFootInMetres:1)*100)/100;
 const prices=(details.kind==='both'?['regular','deep']:[details.kind]).map(kind=>{
  const c=config[kind];
  const minutes=c.baseMinutes+(area===null?Math.max(0,details.bedrooms-base.bedrooms)*c.unknownBedroomMinutes:Math.max(0,area-base.area)*c.areaMinutes)+Math.max(0,details.bathrooms-base.bathrooms)*c.bathroomMinutes+Math.max(0,details.beds-base.beds)*c.bedMinutes;
  // Calibrated customer price per labour-minute for each standard; not Cleaner pay.
  const price=Math.max(c.minimum,Math.ceil((minutes*c.minimum/c.baseMinutes-1e-9)/5)*5);
  const low=Math.floor(minutes/(kind==='deep'?30:15))*(kind==='deep'?30:15),high=Math.ceil(minutes/15)*15+(kind==='deep'?15:0);
  return {kind,price,minutesLow:low,minutesHigh:high};
 });
 return {version:config.version,details,prices,sizeUnknown:area===null};
}
module.exports={config,limits,validate,quote,QuoteInputError};
