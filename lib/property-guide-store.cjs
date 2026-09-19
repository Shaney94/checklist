const {database}=require('./calendar-store.cjs');
function createStore(db=database()){return {
 async load(owner,id){return (await db`SELECT revision,guide FROM turnli_property_guides WHERE owner_id=${owner} AND property_id=${id}`)[0]||{revision:0,guide:{}};},
 async save(owner,id,revision,guide){
  // Membership of the property in the workspace is rechecked at the write boundary.
  const property=JSON.stringify({properties:[{id}]});
  await db`INSERT INTO turnli_property_guides(owner_id,property_id) SELECT owner_id,${id} FROM turnli_dashboard WHERE owner_id=${owner} AND data @> ${property}::jsonb ON CONFLICT DO NOTHING`;
  return (await db`UPDATE turnli_property_guides SET guide=${JSON.stringify(guide)}::jsonb,revision=revision+1,updated_at=now() WHERE owner_id=${owner} AND property_id=${id} AND revision=${revision} AND EXISTS (SELECT 1 FROM turnli_dashboard WHERE owner_id=${owner} AND data @> ${property}::jsonb) RETURNING revision,guide`)[0];
 }
};}
module.exports={createStore};
