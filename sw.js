const STATIC_CACHE = "storytracker-static-v1";
const DYNAMIC_CACHE = "storytracker-dynamic-v2";
const CACHE_PREFIX = "storytracker-";
const CURRENT_CACHES =[STATIC_CACHE, DYNAMIC_CACHE];
const APP_SHELL = [
    "/",
    "/index.html",
    "/offline.html",
    "/css/styles.css",
    "/manifest.json",
    "/js/app.js",
    "/js/ui.js",
    "/images/icons/pen.png"
    
]; 

//Install
self.addEventListener("install",(event)=> {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache)=>
            cache.addAll(APP_SHELL)),
    );
});

//Activate
self.addEventListener("activate",(event)=>{
    event.waitUntil(
        caches.keys().then((keys)=>{
            const oldCaches = keys.filter((key)=>key.startsWith(CACHE_PREFIX)&&
        !CURRENT_CACHES.includes(key),
    );
    return Promise.all(oldCaches.map((key) => caches.delete(key)));

        })
        .then(()=>self.clients.claim())
    );
});

//Helper Functions
function isApiRequested(url){
    return (url.origin.self.location.origin && url.pathname.startsWith("/api/"));
}

function isApprovedExternalAsset(url){
return [
    "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"
    ].includes(url.hostname);
}


function shouldRuntimeCache(request, url){
    const cacheDestinations = new Set([
        "document", "style","script","image", "font"
    ]);
if (!cacheDestinations.has(request.destination)){
    return false;
}
return url.origin === self.location.origin || isApprovedExternalAsset(url)
}

async function cacheFirst(request){
const cached = await caches.match(request);
if(cached)return cached;
try{
    const response = await fetch(request)
    const url = new URL(request.url);
    if(shouldRuntimeCache(request.url)&& (response.ok || response.type === "opaque")){
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());

        } 
        return response;
    } catch(error){
        if(request.mode === "navigate"){
            const offlinePage = await caches.match("/offline.html")
            if(offlinePage) return offlinePage;
        }
        return new Response("Resource unavailable while offline",{
            status: 504,
            statusText: "offline",
        });
    }
} 




//fetch
self.addEventListener("fetch",(event)=>{
   const {request}  = event;
   if(request.method !== "GET") return;
   const url = new URL(request.url);
   if(isApiRequested(url)){
    event.respondWith(fetch(request));
    return;
   }

   event.respondWith(cacheFirst(request));
});