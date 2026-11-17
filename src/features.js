// Feature modules started by app.js after the core is up. Each is `async app => {}`. Order matters a little:
// tours before search (search lists tours), music before onboarding (the sound prompt).
import share from './ui/share.js';
import tours from './ui/tours.js';
import search from './ui/search.js';
import music from './audio/music.js';
import record from './record/record.js';
import settings from './ui/settings.js';
import onboarding from './ui/onboarding.js';
export const features = [share, tours, search, music, record, settings, onboarding];
