import{
    collection,
    serverTimestamp, 
    query, 
    orderBy, 
    getDocsFromServer,
    setDoc, 
    onSnapshot,
    doc, 
    deleteDoc,
    getDoc
    } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    openDatabase,
    PENDING_STORE,
    removedSyncChanges,
    mergeServerTrackers
} from "./idb-Storage.js";

import{db} from "./firebaseConfig.js";

//sync
let syncInProgress = false;
let syncAgain = false;

//The name of my collection
const trackersRef = collection(db, "trackers");
const trackersQuery = query(
    trackersRef, 
    orderBy("createdAt", "desc"));

function timestampToMillis(timestamp) {
    if (typeof timestamp?.toMillis === "function") {
        return timestamp.toMillis();
    }

    if (typeof timestamp === "number") {
        return timestamp;
    }

    return null;
}

function fromFirestore(docSnap){
    const data = docSnap.data();
    return{
        id: docSnap.id,
        title: data.title || "",
        category: data.category || "other",
        genre: data.genre || "",
        website: data.website || "",
        email: data.email || "",
        address: data.address || "",
        wordCount: data.wordCount || "",
        notes: data.notes || "",
        status: data.status || "active",
        createdAtMs: timestampToMillis(data.createdAt) ?? data.createdAtMs ?? 0,
        updatedAtMs: timestampToMillis(data.updatedAt) ?? data.updatedAtMs ?? 0,
    };
}



//Read
export async function loadTrackerFromServer(){
    const snapshot = await getDocsFromServer(trackersQuery);
    return snapshot.docs.map(fromFirestore);
}
//sync data
 

export async function syncTrackerChange(change) {
    const trackerRef = doc(db, "trackers", change.trackerId);

    if (change.type === "delete") {
        await deleteDoc(trackerRef);
        return;
    }

    const data = change.data;

    const existing = await getDoc(trackerRef);

    const firestoreData = {
        title: data.title || "",
        category: data.category || "other",
        genre: data.genre || "",
        website: data.website || "",
        email: data.email || "",
        address: data.address || "",
        wordCount: data.wordCount || "",
        notes: data.notes || "",
        status: data.status || "active",
        updatedAt: serverTimestamp()
    };

    // Preserve an existing creation timestamp.
    // Add one if this is a new or legacy document.
    if (!existing.exists() || !existing.data()?.createdAt) {
        firestoreData.createdAt = serverTimestamp();
    }

    await setDoc(trackerRef, firestoreData, {
        merge: true
    });
}


//2nd read
export function watchTrackers(onData, onError){

 return onSnapshot(trackersQuery, {includeMetadataChanges :true}, (snapshot)=>{
onData(snapshot.docs.map(fromFirestore),{
    fromCache:snapshot.metadata.fromCache,
    hasPendingWrites: snapshot.metadata.hasPendingWrites,
    });

 },
onError,
    );
}

export async function readPendingChanges() {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(PENDING_STORE, "readonly");

        const request = tx.objectStore(PENDING_STORE).getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

        tx.oncomplete = () => {
            db.close();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };

        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };

    });
}

export async function synchronizePendingChanges() {

    if (syncInProgress) {
        syncAgain = true;
        return;
    }

    if (!navigator.onLine) return;

    syncInProgress = true;

    try {

        do {

            syncAgain = false;

            let failed = false;

            const changes = await readPendingChanges();

            changes.sort(
                (a, b) => a.queuedAtms - b.queuedAtms
            );

            for (const change of changes) {

                if (!navigator.onLine) {
                    break;
                }

                try {

                    await syncTrackerChange(change);

                    await removedSyncChanges(
                        change.trackerId,
                        change.changeId
                    );

                } catch (error) {

                    console.error(
                        "Could not sync tracker:",
                        change.trackerId,
                        error
                    );

                    failed = true;
                    break;
                }
            }

            if (failed || !navigator.onLine) {
                break;
            }

            const remaining = await readPendingChanges();

            if (remaining.length > 0) {
                syncAgain = true;
            }

            if (remaining.length === 0) {

                try {

                    const serverTrackers =
                        await loadTrackerFromServer();

                    await mergeServerTrackers(
                        serverTrackers,
                        false
                    );

                } catch (error) {

                    console.warn(
                        "Could not refresh server trackers:",
                        error
                    );
                }
            }

        } while (syncAgain);

    } catch (error) {

        console.error(
            "Synchronization failed:",
            error
        );

    } finally {

        syncInProgress = false;

        // Process a request that arrived while syncing.
        if (syncAgain && navigator.onLine) {
            syncAgain = false;
            void synchronizePendingChanges();
        }
    }
}





window.addEventListener("online", async () => {
    try {
        await synchronizePendingChanges();
    } catch (error) {
        console.error("Synchronization failed:", error);
    }
});

window.addEventListener("offline", () => {
    
});

