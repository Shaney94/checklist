const {test}=require('node:test'),assert=require('node:assert/strict');
const {propertyLabels}=require('../lib/property-labels.cjs');
test('minimal labels reveal no customer or address unless safe collision context is needed',()=>{
 const a={id:'aaaa',name:'Duke Street',customerFirstName:'Sarah',unitLabel:'Flat 2/1',address:'private address',email:'private@example.test'};
 assert.deepEqual(propertyLabels([a]),{aaaa:'Duke Street'});
 const b={...a,id:'bbbb',customerFirstName:'James'};
 assert.deepEqual(propertyLabels([a,b]),{aaaa:'Duke Street · Sarah',bbbb:'Duke Street · James'});
 b.customerFirstName='Sarah';b.unitLabel='Flat 3/2';assert.deepEqual(propertyLabels([a,b]),{aaaa:'Duke Street · Flat 2/1',bbbb:'Duke Street · Flat 3/2'});
 b.unitLabel=a.unitLabel;const result=propertyLabels([a,b]);assert.deepEqual(result,propertyLabels([b,a]));assert.notEqual(result.aaaa,result.bbbb);assert(!JSON.stringify(result).includes('private'));
});
