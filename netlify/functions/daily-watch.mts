import type { Config } from '@netlify/functions';
import { runDuePhotoWatches } from '../../api/src/watchRunner.js';

// Scheduled functions are not exposed as public URLs. Netlify invokes
// this function only after a published main-branch deploy.
export default async()=>{
 const result=await runDuePhotoWatches();
 console.info('Scheduled photography watch summary',result);
 return new Response(null,{status:204});
};
export const config:Config={
 schedule:'0 12 * * *' // UTC daily; users choose opt-in for seven days
};
