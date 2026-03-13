const CACHE_NAME = 'mt-exam-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/question_bank.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // API/JSON files use Network First, fallback to cache
    if (event.request.url.includes('question_bank.json')) {
        event.respondWith(
            fetch(event.request).then(response => {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Images use Cache First, fallback to network and then cache it
    if (event.request.headers.get('accept').includes('image') || event.request.url.includes('/images/')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) return response;
                return fetch(event.request).then(fetchRes => {
                    const resClone = fetchRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    return fetchRes;
                });
            })
        );
        return;
    }

    // Default Cache First strategy for JS/CSS/HTML
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
