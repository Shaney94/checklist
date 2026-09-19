const {currentUser,privateHeaders}=require('../../../lib/account.cjs');
const {readFileSync}=require('node:fs');const {join}=require('node:path');const {decryptDashboard}=require('../../../lib/private-content.cjs');
function loadContent(){return JSON.parse(decryptDashboard(JSON.parse(readFileSync(join(process.cwd(),'private/cleaning-content.enc'),'utf8')),process.env.TURNLI_CONTENT_KEY));}
function createHandler(authenticate=currentUser,load=loadContent){return async(req,res)=>{
 privateHeaders(res);if(req.method!=='GET')return res.status(405).end();
 try{const user=await authenticate(req,res);if(!user)return res.status(401).json({error:'Please log in.'});return res.status(200).json({user,content:user.legacyAccess?load():null});}
 catch{return res.status(503).json({error:'We couldn’t open your dashboard. Please try again shortly.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
