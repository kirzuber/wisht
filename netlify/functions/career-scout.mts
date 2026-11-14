import type { Config } from '@netlify/functions';
import { serveCareerScout } from '../../api/src/careerService.js';
export default serveCareerScout;
export const config:Config={path:'/api/career-scout',
 rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:4}
};
