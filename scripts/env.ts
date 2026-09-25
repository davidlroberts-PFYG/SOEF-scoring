import { config } from 'dotenv';

// Scripts run outside Next, so load .env.local (Next's convention) then .env.
config({ path: '.env.local' });
config();
