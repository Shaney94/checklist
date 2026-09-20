const {privateHeaders,validOrigin}=require('../../../lib/account.cjs');
const {quote,QuoteInputError}=require('../../../lib/cleaning-price.cjs');
function createHandler(){return async(req,res)=>{
 privateHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
 if(!validOrigin(req)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Please use the Turnli website.'});
 try{return res.status(200).json(quote(req.body));}
 catch(error){return res.status(error instanceof QuoteInputError?400:503).json({error:error instanceof QuoteInputError?error.message:'We couldn’t calculate your price. Please try again.',field:error instanceof QuoteInputError?error.field:'form'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
