const {home}=require('../../../lib/authorization.cjs');
const {currentUser,privateHeaders}=require('../../../lib/account.cjs');
function createHandler(authenticate=currentUser){return async(req,res)=>{
 privateHeaders(res);if(req.method!=='GET')return res.status(405).end();
 try{const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});if(!home(user))return res.status(403).json({error:'Workspace role unavailable or unsupported. Contact your workspace administrator.'});return res.status(200).json({user,content:null});}
 catch{return res.status(503).json({error:'We couldn’t open your dashboard. Please try again shortly.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
