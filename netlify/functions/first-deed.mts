import type { Config } from '@netlify/functions';
import { serveFirstDeed } from '../../api/src/firstDeed.js';
export default serveFirstDeed;
export const config:Config={path:'/api/first-deed',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:12}};
