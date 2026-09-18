const {createDecipheriv}=require('node:crypto'),{gunzipSync}=require('node:zlib');
function decryptDashboard(data,key){
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(data.iv,'base64'));decipher.setAuthTag(Buffer.from(data.tag,'base64'));
 return gunzipSync(Buffer.concat([decipher.update(Buffer.from(data.content,'base64')),decipher.final()])).toString();
}
module.exports={decryptDashboard};
