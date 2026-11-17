import{collection,
    serverTimestamp, query, orderBy, getDocsFromServer,setDoc, onSnapshot,
     doc, deleteDoc
    } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import{db} from "./firebaseConfig.js";
import {
    getPendingChanges,
    removePendingChange
} from "./idb-storage.js";

//The name of my collection
const trackersRef = collection(db, "trackers");
const trackersQuery = query(trackersRef, orderBy("createdAt", "desc"));

function timestampToMillis(timestamp){
    if(typeof timestamp?.toMillis === "function"){ 
        return timestamp.toMillis();
    }
    return typeof timestamp === "number" ? timestamp: null;
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
        location: data.location || "",
        count: data.count || "",
        notes: data.notes || "",
        status: data.status || "active",
        createdAtMs: timestampToMillis(data.createdAt) || data.createdAtMs || 0,
        updatedAtMs: timestampToMillis(data.updatedAt) || data.updatedAtMs || 0,
    };
}



//Read
export async function loadTrackerFromServer(){
    const snapshot = await getDocsFromServer(trackersQuery);
    return snapshot.docs.map(fromFirestore);
}
//sync data
 export async function syncTrackerChange(change){
    const trackersRef = doc(db, "trackers", change.trackerId);
    if(change.type === "delete"){
        await deleteDoc(trackersRef);
        return;
    }
    const data = change.data;
    const firestoreData = {
        title: data.title,
        category:data.category,
        genre: data.genre || "",
        website: data.website || "",
        email: data.email || "",
        location: data.location,
        count: data.count || "",
        notes: data.notes,
        status: data.status || "active",
        updatedAt: serverTimestamp(),

    };
    if(change.type === "create"){
        firestoreData.createdAt = serverTimestamp();
    }
    await setDoc(trackersRef, firestoreData, {
        merge: change.type !== "create",
    })
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

window.addEventListener("online", ()=>{
    void synchronizePendingChanges()
    
});
window.addEventListener("offline", ()=>{
    void updatedSyncMessage();
});
void startApp();
