const https=require('node:https'),dns=require('node:dns').promises,net=require('node:net'),ipaddr=require('ipaddr.js');
function publicAddress(value){try{return ipaddr.process(value).range()==='unicast';}catch{return false;}}
function feedURL(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hash||value.length>4096)throw Error('Invalid feed URL');
 const host=u.hostname.replace(/^\[|\]$/g,'');
 if(host==='localhost'||host.endsWith('.localhost')||!host.includes('.')||(net.isIP(host)&&!publicAddress(host)))throw Error('Invalid feed host');
 return u;
}
async function fetchCalendar(value,{lookup=dns.lookup,request=https.get}={}){
 const deadline=Date.now()+10000;
 async function read(url,redirects){
  const u=feedURL(url);let timer;
  const records=await Promise.race([lookup(u.hostname,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS timeout')),2000)})]).finally(()=>clearTimeout(timer));
  if(!records.length||records.some(r=>!publicAddress(r.address)))throw Error('Private network blocked');
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('Feed timeout');
  const response=await new Promise((resolve,reject)=>{
   const req=request(u,{headers:{Accept:'text/calendar, text/plain;q=0.9','Accept-Encoding':'identity','User-Agent':'Turnli-Calendar/1.0'},lookup:(host,options,callback)=>options.all?callback(null,records):callback(null,records[0].address,records[0].family)},res=>{
    if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:res.headers.location});return;}
    if(res.statusCode!==200){res.resume();reject(Error('Feed response failed'));return;}
    const chunks=[];let size=0;
    res.on('data',chunk=>{size+=chunk.length;if(size>1048576){req.destroy(Error('Feed too large'));return;}chunks.push(chunk)});
    res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
   });
   const timer=setTimeout(()=>req.destroy(Error('Feed timeout')),remaining);req.on('close',()=>clearTimeout(timer));req.on('error',reject);
  });
  if(response.redirect){if(redirects>=2)throw Error('Too many redirects');return read(new URL(response.redirect,u).href,redirects+1);}
  return response.text;
 }
 return read(value,0);
}
module.exports={fetchCalendar,feedURL,publicAddress};
