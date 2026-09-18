(() => {
 let checking=false;
 async function verify(){if(checking)return;checking=true;try{const r=await fetch('/api/account',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Session could not be verified');const data=await r.json();if(!data.user){location.replace('/?next='+encodeURIComponent('/app'+location.hash));return;}document.body.classList.remove('session-checking');}catch{document.body.classList.add('session-checking');location.replace('/?next='+encodeURIComponent('/app'+location.hash));}finally{checking=false;}}
 window.addEventListener('pageshow',verify);
 window.addEventListener('pagehide',()=>document.body.classList.add('session-checking'));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify();});
 setInterval(verify,60000);
 window.addEventListener('storage',event=>{if(event.key==='turnli-signout')location.replace('/');});
 verify();
})();
