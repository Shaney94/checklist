const {database}=require('./calendar-store.cjs');
function createStore(db=database()){return {
 async seen(owner,user,rows){const unseen=new Set();for(const row of rows){const ids=row.bookings.map(b=>b.id);const [state]=await db`INSERT INTO turnli_calendar_seen(owner_id,user_id,calendar_id,seen_ids) VALUES(${owner},${user},${row.id},${JSON.stringify(ids)}::jsonb) ON CONFLICT(owner_id,user_id,calendar_id) DO UPDATE SET owner_id=EXCLUDED.owner_id RETURNING seen_ids`;const seen=new Set(state.seen_ids);for(const id of ids)if(!seen.has(id))unseen.add(row.id+':'+id);}return unseen;},
 async acknowledge(owner,user,calendar,ids){await db`UPDATE turnli_calendar_seen SET seen_ids=(SELECT coalesce(jsonb_agg(DISTINCT value),'[]'::jsonb) FROM jsonb_array_elements_text(seen_ids || ${JSON.stringify(ids)}::jsonb)) WHERE owner_id=${owner} AND user_id=${user} AND calendar_id=${calendar}`;},
 async preferences(owner,user){const [row]=await db`SELECT sidebar_collapsed FROM turnli_ui_preferences WHERE owner_id=${owner} AND user_id=${user}`;return {sidebarCollapsed:row?.sidebar_collapsed===true};},
 async savePreferences(owner,user,collapsed){await db`INSERT INTO turnli_ui_preferences(owner_id,user_id,sidebar_collapsed) VALUES(${owner},${user},${collapsed}) ON CONFLICT(owner_id,user_id) DO UPDATE SET sidebar_collapsed=EXCLUDED.sidebar_collapsed`;return {sidebarCollapsed:collapsed};}
};}
module.exports={createStore};
