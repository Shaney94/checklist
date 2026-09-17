(() => {
 const dialog=document.getElementById('accountDialog'),title=document.getElementById('accountTitle'),message=document.getElementById('accountMessage');
 const signIn=document.getElementById('signInForm'),verify=document.getElementById('verifyForm'),invite=document.getElementById('inviteForm'),success=document.getElementById('accountSuccess');
 let loginEmail='',intent='invite',returnFocus,accountUser=null,accountVersion=0;
 const profileButton=document.getElementById('profileButton');
 function setUser(user){
  accountUser=user;accountVersion++;
  document.getElementById('profileLabel').textContent=user?'Signed in':'Sign in';
  document.getElementById('profileAvatar').textContent=user?user.email.slice(0,1).toUpperCase():'○';
  profileButton.setAttribute('aria-label',user?'Signed in as '+user.email+'. View account':'Sign in to Turnly');
  profileButton.title=user?user.email:'Sign in to Turnly';
  document.getElementById('inviteCustomers').hidden=!!user&&!user.canInvite;
 }
 async function request(body){
  const response=await fetch('/api/account',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{throw new Error('Account service is unavailable. Please try again shortly.');}
  if(!response.ok) throw new Error(data.error||'Please try again shortly.');
  return data;
 }
 function show(part,heading){[signIn,verify,invite,success].forEach(el=>el.hidden=el!==part);title.textContent=heading;message.textContent='';const target=part?.querySelector('input,button')||title;title.tabIndex=-1;target.focus();}
 function ready(user){
  setUser(user);
  if(intent==='invite'&&user?.canInvite){show(invite,'Invite a customer');return;}
  if(intent==='invite'){show(success,'Owner sign-in required');success.querySelector('p').textContent='Your account is signed in. Only the Turnly owner can send customer invitations.';}
  else if(intent==='profile'){show(success,'Your account');success.querySelector('p').textContent='Signed in as '+user.email+'.';}
  else{show(success,'Welcome to Turnly');success.querySelector('p').textContent='Signed in as '+user.email+'. Your account is ready.';}
  document.getElementById('signOutButton').hidden=false;
 }
 async function openAccount(mode='invite'){
  intent=mode;returnFocus=document.activeElement;show(signIn,mode==='join'?'Join Turnly':mode==='profile'?'Sign in to Turnly':'Sign in to invite customers');
  document.getElementById('signInDescription').textContent=mode==='invite'?'Sign in with your owner email. We’ll send you a code.':'Enter the email address where you received your invitation.';
  document.getElementById('signOutButton').hidden=true;
  dialog.showModal();
  try{const data=await request();if(!dialog.open)return;setUser(data.user);if(data.user){ready(data.user);document.getElementById('signOutButton').hidden=false;}}
  catch(error){message.textContent=error.message;}
 }
 document.getElementById('inviteCustomers').addEventListener('click',()=>openAccount());
 profileButton.addEventListener('click',()=>openAccount('profile'));
 const initialVersion=accountVersion;
 request().then(data=>{if(accountVersion===initialVersion)setUser(data.user);}).catch(()=>{});
 async function submitting(form,action){const button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='';try{await action();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}}
 signIn.addEventListener('submit',event=>{event.preventDefault();submitting(signIn,async()=>{
  loginEmail=document.getElementById('ownerEmail').value.trim();await request({action:'send-code',email:loginEmail});show(verify,'Check your email');document.getElementById('codeDescription').textContent='Enter the six-digit code sent to '+loginEmail+'.';
 });});
 verify.addEventListener('submit',event=>{event.preventDefault();submitting(verify,async()=>{const data=await request({action:'verify-code',email:loginEmail,code:document.getElementById('emailCode').value.trim()});ready(data.user);document.getElementById('signOutButton').hidden=false;});});
 invite.addEventListener('submit',event=>{event.preventDefault();submitting(invite,async()=>{
  const result=await request({action:'invite',email:document.getElementById('customerEmail').value.trim()});
  if(result.sent!==true)throw new Error('Invitation could not be confirmed. Please try again.');
  show(success,'Invitation sent');success.querySelector('p').textContent='Your customer will receive an email inviting them to join Turnly.';invite.reset();
 });});
 document.getElementById('changeEmail').addEventListener('click',()=>{verify.reset();show(signIn,intent==='join'?'Join Turnly':intent==='profile'?'Sign in to Turnly':'Sign in to invite customers');});
 document.getElementById('signOutButton').addEventListener('click',async()=>{try{await request({action:'logout'});setUser(null);dialog.close();}catch(error){message.textContent=error.message;}});
 dialog.addEventListener('close',()=>{verify.reset();if(returnFocus?.isConnected&&!returnFocus.closest('.hidden'))returnFocus.focus();});
 if(new URLSearchParams(location.search).has('join')){
  const url=new URL(location);url.searchParams.delete('join');history.replaceState(history.state,'',url.pathname+url.search+url.hash);openAccount('join');
 }
})();
