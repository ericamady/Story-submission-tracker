const DATABASE_NAME = "storysubmissiontracker";
const DATABASE_VERSION = 2;
const STORE_NAME = "trackers";
const PENDING_STORE = "pendingChanges";
function openDatabase(){
    return new Promise((resolve, reject)=>{
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = ()=>{
            const db = request.result;
            if(!db.objectStoreNames.contains(STORE_NAME)){
                db.createObjectStore(STORE_NAME, {keyPath: "id"});
            }
            //pending action
            if(!db.objectStoreNames.contains(PENDING_STORE)){
                db.createObjectStore(PENDING_STORE, {keyPath: "trackerId"});
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function readAllTrackers(){
    const db = await openDatabase();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx. objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
    });
}
export async function replaceTrackers(trackers){
     const db = await openDatabase();
     return new Promise((resolve, reject)=>{
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        //remove records
        store.clear();
        trackers.forEach((item) => store.put(item));
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error || new Error("IndexedDB transaction failed"));
        };
        tx.onerror = () =>{

        };
     });
}

function createChangeId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : `change-${Date.now()}-${Math.random()}`;
}
export async function saveTrackAndQueue(tracker, action){
    const db = await openDatabase();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction([STORE_NAME, PENDING_STORE], "readwrite");
        const trackers = tx.objectStore(STORE_NAME);
        const pending = tx.objectStore(PENDING_STORE);
        const previousRequest = pending.get(tracker.id);
        previousRequest.onsuccess = () =>{
            const previous = previousRequest.result;
            const actionType = previous?.type === "create" ? "create" : action;
            const queuedAtms = previous?.queuedAtms || Date.now();
            trackers.put(tracker);
            pending.put({
                trackerId: tracker.id,
                type: actionType,
                data: tracker,
                queuedAtms,
                changeId: createChangeId(),

            });
        };
        tx.oncomplete = ()=>{
            db.close();
            resolve();
        };
        tx.onabort = () =>{
            db.close();
            reject(tx.error ||  new Error("Could not save the offline change."));
        };
        tx.onerror =() =>{};
    });
}

export async function deleteTrackAndQueue(trackerId){
    const db = await openDatabase();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction([STORE_NAME, PENDING_STORE], "readwrite");

        const trackers = tx.objectStore(STORE_NAME);
        const pending = tx.objectStore(PENDING_STORE);
        const previousRequest = pending.get(trackerId);
        trackers.delete(trackerId);
        previousRequest.onsuccess = () =>{
            const previous = previousRequest.result;

            if (previous?.type === "create") {
                pending.delete(trackerId);
                return;
            }
            
            pending.put({
                 trackerId,
                type: "delete",
                queuedAtms: previous?.queuedAtms|| Date.now(),
                changeId: createChangeId()

            });
        };
        tx.oncomplete = ()=>{
            db.close();
            resolve();
        };
        tx.onabort = () =>{
            db.close();
            reject(tx.error ||  new Error("Could not queue the offline delete."));
        };
        tx.onerror =() =>{
            db.close();
            reject(tx.error);
        };
    });
}
