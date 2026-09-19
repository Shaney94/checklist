const sharp=require('sharp');
const {createHash}=require('node:crypto');
const MIN_PHOTOS=3,MAX_PHOTOS=6,MAX_UPLOAD=3*1024*1024;
async function validatePhoto(body){
 const formats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
 if(!Object.hasOwn(formats,body.type)||typeof body.data!=='string'||body.data.length>4*Math.ceil(MAX_UPLOAD/3)||!body.data.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))throw Error('Invalid photo');
 const bytes=Buffer.from(body.data,'base64');
 if(!bytes.length||bytes.length>MAX_UPLOAD||bytes.toString('base64')!==body.data)throw Error('Invalid photo');
 const image=sharp(bytes,{failOn:'warning',limitInputPixels:16000000});
 const meta=await image.metadata();
 if(meta.format!==formats[body.type]||(meta.pages||1)!==1)throw Error('Invalid photo');
 // Fully decode, normalize orientation and re-encode. Do not retain EXIF, GPS,
 // original filenames, embedded profiles or client-supplied storage references.
 const result=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer({resolveWithObject:true});
 if(result.data.length>2*1024*1024)throw Error('Photo too large');
 return {bytes:result.data,width:result.info.width,height:result.info.height,size:result.data.length,sha256:createHash('sha256').update(result.data).digest('hex')};
}
module.exports={MIN_PHOTOS,MAX_PHOTOS,MAX_UPLOAD,validatePhoto};
