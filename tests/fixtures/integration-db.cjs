const enabled=process.env.TURNLI_TEST_DATABASE==='1';
if(enabled)require('./postgres.cjs').install();
module.exports={enabled};
