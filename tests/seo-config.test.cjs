const {test}=require('node:test'),assert=require('node:assert/strict');
const {headers}=require('../vercel.json');

test('Next owns indexing headers; deployment configuration cannot override public indexability',()=>{
 for(const rule of headers||[])assert(!rule.headers.some(header=>header.key.toLowerCase()==='x-robots-tag'));
});
