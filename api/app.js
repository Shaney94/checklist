const {currentUser,privateHeaders}=require('../lib/account.cjs');
const {readFileSync}=require('node:fs'),{join}=require('node:path');const {decryptDashboard}=require('../lib/private-content.cjs');
function createApp(authenticate=currentUser,load=()=>decryptDashboard(JSON.parse(readFileSync(join(__dirname,'../private/dashboard.enc'),'utf8')),process.env.TURNLI_CONTENT_KEY)){
 return async(req,res)=>{
  privateHeaders(res);res.setHeader('Content-Type','text/html; charset=utf-8');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
  try{
   if(!await authenticate(req,res)){res.setHeader('Location','/?next=%2Fapp');return res.status(303).end();}
   return res.status(200).end(load());
  }catch{return res.status(503).end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Turnli</title><h1>We couldn’t open your dashboard.</h1><p>Please try again shortly.</p><a href="/">Return to login</a></html>');}
 };
}
module.exports=createApp();module.exports.createApp=createApp;
