import type { Config } from '@netlify/functions';
import { serveSoccerScout } from '../../api/src/soccerService.js';
export default serveSoccerScout;
export const config:Config={path:'/api/soccer-scout',
 rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}
};
