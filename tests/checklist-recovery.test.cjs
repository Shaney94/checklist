const {test}=require('node:test'),assert=require('node:assert/strict');
const {templates}=require('../lib/checklist-templates.cjs');
const {change}=require('../src/server/handlers/dashboard.js');
test('recovered standard lists retain the established detailed task groups',()=>{
 assert.equal(templates.regular.length,38);assert.equal(templates.deep.length,109);
 assert.equal(new Set(templates.regular.map(t=>t.split(' — ')[0])).size,6);assert.equal(new Set(templates.deep.map(t=>t.split(' — ')[0])).size,11);
 assert(templates.regular.some(t=>/coffee beans/.test(t)));assert(templates.deep.some(t=>/coffee machine/i.test(t)));
 for(const tasks of Object.values(templates))for(const task of tasks){assert(task.length<=500);assert(!/by text|IKEA bag|storage cupboard|behind the radiator|beside radiator/i.test(task));}
});
test('existing custom checklists/progress are preserved until explicit standard template adoption',()=>{
 const property={id:'synthetic',name:'Before',phone:'',notes:'',regular:['Custom task'],deep:['Custom deep'],checked:{regular:[0],deep:[0]},notApplicable:{regular:[],deep:[0]}};
 const original={properties:[property]};
 const renamed=change(original,{action:'property',id:property.id,name:'After',phone:'',notes:''});assert.deepEqual(renamed.properties[0].regular,['Custom task']);assert.deepEqual(renamed.properties[0].checked,property.checked);
 const restored=change(renamed,{action:'template',id:property.id,kind:'regular'});assert.deepEqual(restored.properties[0].regular,templates.regular);assert.deepEqual(restored.properties[0].checked.regular,[]);assert.deepEqual(restored.properties[0].deep,property.deep);assert.deepEqual(original.properties[0],property);
 const coffee=templates.regular.findIndex(t=>/coffee beans/.test(t));
 const applicable=change(restored,{action:'applicability',id:property.id,kind:'regular',index:coffee,applicable:false});assert.deepEqual(applicable.properties[0].notApplicable.regular,[coffee]);assert.deepEqual(applicable.properties[0].regular,templates.regular);
});

test('adoption remaps applicability by task identity and is idempotent, including empty lists',()=>{
 const original={properties:[{id:'p',regular:[templates.regular[7],templates.regular[2]],deep:[],checked:{regular:[1],deep:[]},notApplicable:{regular:[0],deep:[]}}]};
 const adopted=change(original,{action:'template',id:'p',kind:'regular'});
 assert.deepEqual(adopted.properties[0].notApplicable.regular,[7]);assert.deepEqual(adopted.properties[0].checked.regular,[2]);
 assert.deepEqual(change(adopted,{action:'template',id:'p',kind:'regular'}),adopted);
 assert.equal(change(adopted,{action:'template',id:'p',kind:'deep'}).properties[0].deep.length,109);
 assert.deepEqual(original.properties[0].notApplicable.regular,[0]);
 const unmatched=structuredClone(original);unmatched.properties[0].regular[0]='Unmatched property-specific task';
 assert.throws(()=>change(unmatched,{action:'template',id:'p',kind:'regular'}));assert.deepEqual(unmatched.properties[0].notApplicable.regular,[0]);
});

test('new property defaults need no adoption and adopted standards survive property edits/applicability',()=>{
 let data=change({properties:[]},{action:'property',name:'New property',phone:'',notes:''});const id=data.properties[0].id;
 assert.equal(data.properties[0].regular.length,38);assert.equal(data.properties[0].deep.length,109);
 data=change(data,{action:'applicability',id,kind:'regular',index:7,applicable:false});
 data=change(data,{action:'property',id,name:'Renamed property',phone:'',notes:''});
 assert.deepEqual(data.properties[0].regular,templates.regular);assert.deepEqual(data.properties[0].deep,templates.deep);assert.deepEqual(data.properties[0].notApplicable.regular,[7]);
});
