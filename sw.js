'use strict';

/*
    super basic boiler-plate service worker for PWA
 */

importScripts('./node_modules/sw-toolbox/sw-toolbox.js');
toolbox.precache(['index.html','main.css']);
toolbox.router.get('/images/*', toolbox.cacheFirst);
toolbox.router.get('/*', toolbox.networkFirst, { networkTimeoutSeconds: 5});