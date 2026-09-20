const {test}=require('node:test'),assert=require('node:assert/strict');
const {quote,QuoteInputError}=require('../lib/cleaning-price.cjs');
const {createHandler}=require('../src/server/handlers/quote.js');
const baseline={location:'Glasgow G12',bedrooms:2,beds:2,bathrooms:1,sizeUnit:'m2',size:52,kind:'both',cleansPerMonth:null};
test('baseline independently calibrates Regular and Deep prices and time',()=>{assert.deepEqual(quote(baseline).prices,[{kind:'regular',price:60,minutesLow:120,minutesHigh:120},{kind:'deep',price:130,minutesLow:240,minutesHigh:270}]);});
test('minimum floors hold for smaller homes; both standards increase with labour',()=>{
 assert.deepEqual(quote({...baseline,size:15,bedrooms:0,beds:1}).prices.map(p=>p.price),[60,130]);
 for(const extra of [{bathrooms:2},{beds:3},{size:90}]) for(const [i,p] of quote({...baseline,...extra}).prices.entries()){assert(p.price>quote(baseline).prices[i].price);assert(p.minutesHigh>quote(baseline).prices[i].minutesHigh);}
});
test('known size avoids double-counting bedrooms; frequency never discounts',()=>{
 for(const change of [{bedrooms:8},{cleansPerMonth:0},{cleansPerMonth:93}])assert.deepEqual(quote({...baseline,...change}).prices,quote(baseline).prices);
});
test('square feet normalise equivalently and unknown area remains unknown',()=>{
 assert.deepEqual(quote({...baseline,sizeUnit:'ft2',size:52/0.09290304}).prices,quote(baseline).prices);
 const q=quote({...baseline,sizeUnit:'unknown',size:null});assert.equal(q.details.size,null);assert.equal(q.sizeUnknown,true);assert.deepEqual(q,quote({...baseline,sizeUnit:'unknown',size:null}));
 assert(quote({...baseline,sizeUnit:'unknown',size:null,bedrooms:4}).prices[0].price>q.prices[0].price);
});
test('rounding to £5 is deterministic and single clean selections are respected',()=>{
 for(const kind of ['regular','deep'])for(const size of [52,53,79.5,130,500]){const input={...baseline,kind,size};const q=quote(input);assert.equal(q.prices.length,1);assert.equal(q.prices[0].price%5,0);assert.deepEqual(q,quote(input));}
});
test('invalid, extreme, unknown fields and client prices are rejected',()=>{
 for(const changes of [{location:''},{location:'x'.repeat(161)},{location:'<script>'},{bedrooms:-1},{bedrooms:13},{beds:0},{beds:25},{beds:2.5},{bathrooms:0},{bathrooms:13},{size:Infinity},{size:NaN},{size:0},{size:501},{size:'52'},{sizeUnit:'acres'},{sizeUnit:'unknown',size:52},{cleansPerMonth:-1},{cleansPerMonth:94},{kind:'weekly'},{price:1}])assert.throws(()=>quote({...baseline,...changes}),QuoteInputError);
});
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
test('public endpoint returns authoritative quote anonymously without persistence',async()=>{
 const r=res();await createHandler()({method:'POST',headers:{origin:'https://turnli.io','content-type':'application/json'},body:baseline},r);assert.equal(r.code,200);assert.equal(r.data.prices[0].price,60);assert.match(r.headers['Cache-Control'],/no-store/);
 for(const [body,origin,status] of [[{...baseline,price:1},'https://turnli.io',400],[baseline,'https://evil.example',403]]){const r=res();await createHandler()({method:'POST',headers:{origin,'content-type':'application/json'},body},r);assert.equal(r.code,status);}
});

test('calibrated floor area preserves all six reference prices and displayed times',()=>{
 const examples=[
  [35,1,1,1,[60,120,120],[130,240,270]],
  [52,2,2,1,[60,120,120],[130,240,270]],
  [70,2,3,1,[75,135,150],[170,330,360]],
  [70,3,3,2,[90,165,180],[200,390,420]],
  [100,3,4,2,[110,210,225],[255,480,525]],
  [150,5,6,3,[160,315,330],[385,720,765]],
 ];
 for(const [size,bedrooms,beds,bathrooms,regular,deep] of examples){
  const input={...baseline,size,bedrooms,beds,bathrooms};
  assert.deepEqual(quote(input).prices.map(p=>[p.price,p.minutesLow,p.minutesHigh]),[regular,deep]);
  assert.deepEqual(quote({...input,sizeUnit:'ft2',size:size/0.09290304}).prices,quote(input).prices);
 }
});

test('reported 60m² postcode example is valid, server-authoritative and frequency independent',async()=>{
 const input={location:'G13 1DF',bedrooms:2,beds:2,bathrooms:2,sizeUnit:'m2',size:60,kind:'both',cleansPerMonth:4};
 const expected=[{kind:'regular',price:80,minutesLow:150,minutesHigh:165},{kind:'deep',price:175,minutesLow:330,minutesHigh:360}];
 assert.deepEqual(quote(input).prices,expected);
 assert.deepEqual(quote({...input,cleansPerMonth:12}).prices,expected);
 assert.deepEqual(quote({...input,sizeUnit:'ft2',size:60/0.09290304}).prices,expected);
 const r=res();await createHandler()({method:'POST',headers:{origin:'https://turnli.io','content-type':'application/json'},body:input},r);
 assert.equal(r.code,200);assert.deepEqual(r.data.prices,expected);
 for(const [field,value] of [['location',''],['size',501],['bathrooms',0],['cleansPerMonth',94]]){
  const r=res();await createHandler()({method:'POST',headers:{origin:'https://turnli.io','content-type':'application/json'},body:{...input,[field]:value}},r);
  assert.equal(r.code,400);assert.equal(r.data.field,field);assert.equal(typeof r.data.error,'string');assert.equal(r.data.stack,undefined);
 }
});
