// Only explicit platform fields or first-party source identifiers count as evidence.
// Guest names, free-form prose, property names and user-selected labels do not.
const platforms=[
 {name:'Airbnb',key:'airbnb',domains:['airbnb.com','airbnb.co.uk'],prodid:/\/\/Airbnb(?:\s|\/)/i},
 {name:'Booking.com',key:'booking',domains:['booking.com'],prodid:/\/\/Booking\.com(?:\s|\/)/i},
 {name:'Vrbo',key:'vrbo',domains:['vrbo.com','homeaway.com'],prodid:/\/\/(?:Vrbo|HomeAway)(?:\s|\/)/i},
 {name:'Houfy',key:'houfy',domains:['houfy.com'],prodid:/\/\/Houfy(?:\s|\/)/i}
];
function exact(value){return platforms.find(p=>p.name.toLowerCase()===String(value||'').trim().toLowerCase());}
function host(value){try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return null;return platforms.find(p=>p.domains.some(d=>url.hostname===d||url.hostname.endsWith('.'+d)));}catch{return null;}}
function detectSource({fields=[],description='',eventURL='',feedURL='',prodid=''}={}){
 const eventSignals=fields.map(exact).filter(Boolean);
 for(const match of description.matchAll(/(?:^|\n)\s*(?:source|platform|booking channel|channel)\s*:\s*([^\n\r]+)/gi)){const p=exact(match[1]);if(p)eventSignals.push(p);}
 const eventHost=host(eventURL);if(eventHost)eventSignals.push(eventHost);
 const signals=eventSignals.length?eventSignals:[host(feedURL),...platforms.filter(p=>p.prodid.test(prodid))].filter(Boolean);
 const unique=[...new Map(signals.map(p=>[p.key,p])).values()];
 return unique.length===1?{source:unique[0].name,sourceKey:unique[0].key,sourceEvidence:eventSignals.length?'event-metadata':'feed-metadata'}:{source:null,sourceKey:'unknown',sourceEvidence:null};
}
module.exports={detectSource,platforms};
