import type { Config } from '@netlify/functions';
export default async()=>Response.json({status:'ok',service:'wisht',execution:false});
export const config:Config={path:'/api/health'};
