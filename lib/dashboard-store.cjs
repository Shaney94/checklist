const {database}=require('./calendar-store.cjs');
function createStore(db=database()) {return {
 async load(owner){const rows=await db`SELECT revision,data FROM turnli_dashboard WHERE owner_id=${owner}`;return rows[0]||{revision:0,data:{properties:[]}};},
 async save(owner,revision,data){await db`INSERT INTO turnli_dashboard(owner_id) VALUES(${owner}) ON CONFLICT DO NOTHING`;return (await db`UPDATE turnli_dashboard SET data=${JSON.stringify(data)}::jsonb,revision=revision+1,updated_at=now() WHERE owner_id=${owner} AND revision=${revision} RETURNING revision,data`)[0];}
};}
module.exports={createStore};
