const DATABASE_NAME = "storysubmissiontracker";
const DATABASE_VERSION = 2;
const STORE_NAME = "trackers";
const PENDING_STORE = "pendingChanges";
export {
    openDatabase,
    PENDING_STORE
};

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
function sortTrackers(trackers){
    return trackers.sort(
        (first,second) =>(second.createdAtMs || 0) - (first.createdAtMs || 0),
    );
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
            db.close();
            reject(tx.error || new Error("Could not replace trackers."));
        };
     });
}
// Merge firestone with local edits

export async function mergeServerTrackers(remoteItems, fromCache = false) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            [STORE_NAME, PENDING_STORE],
            "readwrite"
        );

        const trackerStore = tx.objectStore(STORE_NAME);
        const pendingStore = tx.objectStore(PENDING_STORE);

        const localRequest = trackerStore.getAll();
        const pendingRequest = pendingStore.getAll();

        let localItems;
        let pendingItems;

        let readsFinished = 0;
        let merged = [];

        function finishMerge() {
            readsFinished += 1;

            if (readsFinished !== 2) return;

            const byId = new Map();

            // Start with local or remote data
            const startingList = fromCache
                ? localItems
                : remoteItems;

            startingList.forEach(item => {
                byId.set(item.id, item);
            });

            // When loading from cache, include remote data too
            if (fromCache) {
            remoteItems.forEach(item => {
            if (!byId.has(item.id)) {
            byId.set(item.id, item);
             }
         });
    }

            // Apply pending local changes
            pendingItems.forEach(change => {
                if (change.type === "delete") {
                    byId.delete(change.trackerId);
                } else if (change.type === "create" ||
                           change.type === "update") {
                    byId.set(change.trackerId, change.data);
                }
            });

            merged = sortTrackers([...byId.values()]);

            // Save merged data locally
            trackerStore.clear();

            merged.forEach(item => {
                trackerStore.put(item);
            });
        }

        localRequest.onsuccess = () => {
            localItems = localRequest.result;
            finishMerge();
        };

        pendingRequest.onsuccess = () => {
            pendingItems = pendingRequest.result;
            finishMerge();
        };

        tx.oncomplete = () => {
            db.close();
            resolve(merged);
        };

        tx.onabort = () => {
            db.close();
            reject(
                tx.error ||
                new Error("Could not merge trackers.")
            );
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}


function createChangeId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : `change-${Date.now()}-${Math.random()}`;
}

export async function saveTrackAndQueue(tracker, action) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            [STORE_NAME, PENDING_STORE],
            "readwrite"
        );

        const trackers = tx.objectStore(STORE_NAME);
        const pending = tx.objectStore(PENDING_STORE);

        const previousRequest = pending.get(tracker.id);

        previousRequest.onsuccess = () => {
            const previous = previousRequest.result;

            const actionType =
                previous?.type === "create"
                    ? "create"
                    : action;

            trackers.put(tracker);

            pending.put({
                trackerId: tracker.id,
                type: actionType,
                data: tracker,
                queuedAtms: previous?.queuedAtms ?? Date.now(),
                changeId: createChangeId()
            });
        };

        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };

        tx.onabort = () => {
            db.close();
            reject(
                tx.error ||
                new Error("Could not save the offline change.")
            );
        };

        tx.onerror = () => {
            db.close();
            reject(
                tx.error ||
                new Error("Could not save the offline change.")
            );
        };
    });
}






export async function deleteTrackAndQueue(trackerId) {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            [STORE_NAME, PENDING_STORE],
            "readwrite"
        );

        const trackers = tx.objectStore(STORE_NAME);
        const pending = tx.objectStore(PENDING_STORE);

        const previousRequest = pending.get(trackerId);

        trackers.delete(trackerId);

        previousRequest.onsuccess = () => {

            const previous = previousRequest.result;

            pending.put({

                trackerId,

                type: "delete",

                queuedAtms:
                    previous?.queuedAtms ?? Date.now(),

                changeId: createChangeId()

            });
        };

        tx.oncomplete = () => {

            db.close();

            resolve(true);
        };

        tx.onerror = () => {

            db.close();

            reject(
                tx.error ||
                new Error("Could not queue the offline delete.")
            );
        };

        tx.onabort = () => {

            db.close();

            reject(
                tx.error ||
                new Error("Could not queue the offline delete.")
            );
        };

    });
}





export async function removedSyncChanges(trackerId, changeId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(PENDING_STORE, "readwrite");
        const store = tx.objectStore(PENDING_STORE);
        const request = store.get(trackerId);

        request.onsuccess = () => {
            // Only remove the exact change that was synchronized.
            // Never remove a newer edit.
            if (request.result?.changeId === changeId) {
                store.delete(trackerId);
            }
        };

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error || new Error("Could not remove synced change."));
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error("Could not remove synced change."));
        };
    });
}
