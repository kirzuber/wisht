import type { Config } from '@netlify/functions';
export default async()=>Response.json({error:'This specialized tool was retired. Start a new Wish with Jinn.'},{status:410});
export const config:Config={path:[
 '/api/interpret','/api/examples','/api/scout','/api/opportunity-detail',
 '/api/career-scout','/api/soccer-scout','/p/*'
]};
