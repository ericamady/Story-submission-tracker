
import { 
    watchTrackers, 
    synchronizePendingChanges
} from "./tracker-service";

import { readAllTrackers, replaceTrackers, saveTrackAndQueue, deleteTrackAndQueue } from "./idb-Storage";

    //service worker registration
    if("serviceWorker" in navigator){
        window.addEventListener("load", async() =>{
            try{
                const registration = await navigator.serviceWorker.register("./sw.js");
                console.log("Story Submission Tracker service worker registered", registration.scope);
            }catch(error){
                console.error("FieldSync service worker registration failed;", error);
            }
        });
    }
    //PWA install button
     let installPrompt  = null;
     const installButton = document.querySelector("#installApp");
     window.addEventListener("beforeinstallprompt", (event) =>{
        event.preventDefault();
        installPrompt = event;

        if(installButton){
            installButton.hidden = false;
        }
    });

    if(installButton){
        installButton.addEventListener("click", async()=>{
            if(!installPrompt) return;

            const result = await installPrompt.prompt();
            console.log("Install choice:", result.outcome);
            
            installPrompt = null;
            installButton.hidden = true;
        });
    }

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  console.log("FieldSync was installed.");
});

//connect html and javascript
const form = document.querySelector("#add-tracker-form");
const list = document.querySelector("#dash-list");
const statusMessage = document.querySelector("#tracker-status");

const magazine = document.querySelector("#magazine-list");
const contest = document.querySelector("#contest-list");
const publisher = document.querySelector("#publisher-list");
const story = document.querySelector("#story-list");
const statusMessagePub = document.querySelector("#publisher-status");
const statusMessageMag = document.querySelector("#magazine-status");
const statusMessageCon = document.querySelector("#contest-status");
const statusMessageStory = document.querySelector("#story-status");
const countBadge = document.querySelector("#tracker-count");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-tracker");
const cancelEditButton = document.querySelector("#cancel-edit");
const trackerFormPanel = document.querySelector("#tracker-form");

let editingTrackerId = null;
let currentTrackers = [];
const dataSource = document.querySelector("#data-source");
let serverSnapshotRecieved = false;
let firebaseListenerStarted = false;
let firebaseLoading = false;

function showDataSource(message){
    if(dataSource) dataSource.textContent = message;
}

function cancelEditOnline(){
    if(navigator.onLine) return true;
    showToast("connect to the internet to add, edit , or delete trackers");
    return false;
}
function toLocalTracker(item){
    
    return {
        id: item.id,
        title: item.title || "",
        category: item.category || "other",
        genre: item.genre || "",
        website: item.website || "",
        email: item.email || "",
        location: item.location || "",
        count: item.count || "",
        notes: item.notes || "",
        status: item.status || "active",

        createdAtMs:
            item.createdAtMs ??
            item.createdAt?.toMillis?.() ??
            null,

        updatedAtMs:
            item.updatedAtMs ??
            item.updatedAt?.toMillis?.() ??
            null,
    };
}

function showToast(message){
    if(typeof M !=="undefined"){
        M.toast({html: message});
} else{
        console.log(message);
      }
    }
function escapeHtml(value = ""){
        return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
      }
function makeLocalId(){
    if(crypto.randomUUID) return crypto.randomUUID();
    return `tracker-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
      //json objects

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return "Saving...";
    }

    let date;

    if (typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
    } else if (typeof timestamp === "number") {
        date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return "Date unavailable";
    }

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

//create page to display form data on dashboard
statusMessage.hidden= true;

/*trackers.forEach((item)=>{
        dash.insertAdjacentHTML("beforeend",
      `
        <article class="card-panel blue lighten-5 tracker-card">
          <div class="row valign-wrapper no-margin-bottom">
            <div class="col s3 m2 center-align">
              <i class="material-icons medium ${category.iconClass}">${category.icon}</i>
            </div>

            <div class="col s7 m8">
              <h5 class="black-text">${escapeHtml(item.title)}</h5>
              <p class="grey-text text-darken-1">${escapeHtml(item.notes || "")}</p>
              <p class="grey-text">
                <i class="material-icons tiny">place</i>
                ${escapeHtml(item.location || "No location")} &nbsp; | &nbsp;
                ${escapeHtml(formatTimestamp(item.createdAtMs))}
              </p>
            </div>

            <div class="col s2 m2 right-align">
              <button
                class="btn-flat edit-btn"
                type="button"
                data-id="${item.id}"
                aria-label="Edit ${escapeHtml(item.title)} tracker"
              >
                <i class="material-icons blue-text text-darken-1">edit</i>
              </button>

              <button
                class="btn-flat delete-btn"
                type="button"
                data-id="${item.id}"
                aria-label="Delete ${escapeHtml(item.title)} tracker"
              >
                <i class="material-icons grey-text text-darken-1">delete_outline</i>
              </button>
            </div>
          </div>
        </article>
      `,
    );
  });
}
*/

// form results for individual pages

function renderTrackers(trackers) {
    

    currentTrackers = trackers;

    if (!list || !statusMessage) return;

    list.innerHTML = "";

    if (countBadge) {
        countBadge.textContent = trackers.length;
    }

    if (trackers.length === 0) {
        statusMessage.textContent =
            "No trackers yet. Add your first tracker.";

        statusMessage.hidden = false;
        return;
    }

    statusMessage.hidden = true;

    trackers.forEach((item) => {

        const category = categoryDetails(item.category);

        const li = document.createElement("li");

        li.className = "collection-item tracker-item";

        li.innerHTML = `
            <div class="row valign-wrapper no-margin-bottom">

                <div class="col s2 center-align">
                    <i class="material-icons medium ${category.iconClass}">
                        ${category.icon}
                    </i>
                </div>

                <div class="col s8">

                    <span class="${category.labelClass}">
                        <strong>${category.label}</strong>
                    </span>

                    <h6 class="black-text">
                        ${escapeHtml(item.title)}
                    </h6>

                    <p class="grey-text text-darken-1">
                        ${escapeHtml(item.notes || "No description")}
                    </p>

                    <small class="grey-text">
                        <i class="material-icons tiny">place</i>
                        ${escapeHtml(item.location || "No location")}
                    </small>

                    <br>

                    <small class="grey-text">
                        Submitted:
                        ${escapeHtml(formatTimestamp(item.createdAtMs))}
                    </small>

                </div>

                <div class="col s2 right-align">

                    <button
                        class="btn-flat edit-btn"
                        type="button"
                        data-id="${escapeHtml(item.id)}"
                        aria-label="Edit tracker"
                    >
                        <i class="material-icons blue-text">edit</i>
                    </button>

                    <button
                        class="btn-flat delete-btn"
                        type="button"
                        data-id="${escapeHtml(item.id)}"
                        aria-label="Delete tracker"
                    >
                        <i class="material-icons red-text">delete</i>
                    </button>

                </div>

            </div>
        `;

        list.appendChild(li);
    });
}





//Categories








const trackerSections = {
    publisher: {
        list: publisher,
        status: statusMessagePub,
        label: "Publisher"
    },
    magazine: {
        list: magazine,
        status: statusMessageMag,
        label: "Magazine"
    },
    contest: {
        list: contest,
        status: statusMessageCon,
        label: "Contest"
    },
    story: {
        list: story,
        status: statusMessageStory,
        label: "Story"
    }
};

function resetFormToCreateMode(){
    editingTrackerId = null;
 
    if(!form) return;
    form.reset();
    formTitle.textContent = "Add New Tracker.";
    if(saveButton){
        saveButton.innerHTML = "Add Tracker <i class = material-icons right>save</i>";
    }
    if (cancelEditButton){
        cancelEditButton.hidden = true;
    }
    if(typeof M !=="undefined"){
        M.updateTextFields();

        const categorySelect = form.querySelector("#category");
         if (categorySelect) {
            const instance = M.FormSelect.getInstance(categorySelect);

            if (instance) instance.destroy();

            M.FormSelect.init(categorySelect);
        }
    }
}

function startEdit(id){
    if(!cancelEditOnline()) return;
    const tracker = currentTrackers.find((item)=> item.id === id);
    if(!tracker ||!form) return;
    
    editingTrackerId = id;

    form.querySelector("#title").value = tracker.title || "";
    form.querySelector("#category").value = tracker.category || "";
    form.querySelector("#genre").value = tracker.genre || "";
    form.querySelector("#website").value = tracker.website || "";
    form.querySelector("#email").value = tracker.email || "";
    form.querySelector("#location").value = tracker.location || "";
    form.querySelector("#count").value = tracker.notes || "";
    form.querySelector("#description").value = tracker.notes || "";

    formTitle.textContent = "Edit Tracker";
    saveButton.innerHTML =`Save changes<i class= material-icons right>save</i>`;
    cancelEditButton.hidden = false;
    if(typeof M !== "undefined"){
        M.updateTextFields();
        M.textareaAutoResize(form.querySelector("#description"));
        const categorySelect = form.querySelector("#category");
        const selectInstance = M.FormSelect.getInstance(categorySelect);

        if(selectInstance)selectInstance.destroy();
        M.FormSelect.init(categorySelect);

        const panel = M.Sidenav.getInstance(trackerFormPanel);
        if(panel) panel.open();
    }
}

if(form){
    form.addEventListener("submit", async(event) =>{
        event.preventDefault();

    const existing = currentTrackers.find((item)=>item.id === editingTrackerId,);
    const now = Date.now();
    const tracker = {
        id: editingTrackerId || makeLocalId(),
        title:form.querySelector("#title").value.trim(),
        category:form.querySelector("#category").value.trim(),
        genre:form.querySelector("#genre").value.trim(),
        website:form.querySelector("#website").value.trim(),
        email:form.querySelector("#email").value.trim(), 
        location:form.querySelector("#location").value.trim(),
        count:form.querySelector("#count").value.trim(),
        notes:form.querySelector("#description").value.trim(),
        status:"active",
        createdAtMs: existing?.createdAtMs || now,
        updatedAtMs: now,
    };
        try{
            if(saveButton) saveButton.disabled = true;
            await saveTrackAndQueue(
                tracker,
                editingTrackerId ? "update" : "create",
            );
             await refreshLocalList();
             await updateSyncMessage();
             showToast("Saved on this device. It will sync with Firestore when possible.");

            resetFormToCreateMode();

            if(typeof M !== "undefined"){
                const panel =  M.Sidenav.getInstance(trackerFormPanel);
                if(panel) panel.close()
            }
        }catch(error){
            console.error("Could not save tracker.", error);

            showToast("Could not save the tracker. Check Firebase setup and rules.");
        }finally{
           if(saveButton) {
            saveButton.disabled = false;
        }
        }
    });
}

if(cancelEditButton){
    cancelEditButton.addEventListener("click", () =>{
        resetFormToCreateMode();
    });
}

    document.addEventListener("click", async(event)=>{
        const editButton = event.target.closest(".edit-btn");
        if(editButton){
            startEdit(editButton.dataset.id);
            return;
        }
        const deleteButton = event.target .closest(".delete-btn");
        if(!deleteButton) return;
        if(!cancelEditOnline()) return;

        const id = deleteButton.dataset.id;
        const tracker = currentTrackers.find((item)=>item.id===id);
        if(!window.confirm(`Delete ${tracker?.title || "this tracker"}?`)){ 
            return;
        }
        try{
            deleteButton.disabled = true;
            await deleteTrackAndQueue(id);
            await refreshLocalList();
            showToast("Tracker deleted from Firebase.");
            
        }catch(error){
            console.error("Could not delete tracker:", error);
            showToast("Could not delete the tracker.");
            deleteButton.disabled = false;
        }
    });


async function startApp(){
    try{
        renderTrackers(await readAllTrackers());
        await updateSyncMessage();
    }catch(error){
        console.error("Could not open the local database:", error);
        showDataSource("Local storage could not be opened on this device.");
    }
    try{
        watchTrackers(
            async(remoteTrackers, metadata)=> {
                try{
                    const possiblyIncomplete =
                    metadata.fromCache || metadata.hasPendingWrites;
                    const merged =await mergeServerObstructions(
                        remoteTrackers,
                        possiblyIncomplete,

                    );
                    renderTrackers(merged);
                    await updateSyncMessage(
                        metadata.fromCache
                        ?"Showing saved records while Firestore checks for updates."
                        :"Showing the latest Firestore records and local changes."
                    );
                }catch(error){
                    console.error(
                        "Could not combine local and Firestore records:", error,);
                }
            },
            (error)=>{
                console.error("Could not listen to Firestore:", error );
                void updateSyncMessage(
                    "Firestore is not available. Your saved records are still on this device.",
                );
            },

        );
    }catch(error){
        console.error("Could not start the Firestore listener:", error);
    }
}
async function showSavedTrackersLocal(){
    try{
        const saved = await readAllTrackers();
        if(!serverSnapshotRecieved){
            renderTrackers(saved);
            showDataSource(!navigator.onLine? "Offline: showing trackers saved on this device." 
            : saved.length ? "showing saved trackers from this device." 
            : "No trackers saved on this device yet.",
            );
        }
    }catch(err){
        console.error("Could not read IndexDB", err);
        showDataSource("Local storage could not be opened");
    }
}
async function connectToFirebase(){
    if(!navigator.onLine || firebaseListenerStarted || firebaseLoading) return;
    firebaseLoading = true;
    try{
        watchTrackers((trackers, metadata) =>{
            if(metadata.fromCache || metadata.hasPendingWrites) return;
            serverSnapshotRecieved = true;
            const plain =  trackers.map(toLocalTracker);
            renderTrackers(plain);
            showDataSource("Showing the latest trackers from firebase.");
            replaceTrackers(plain).catch((error)=>{
                console.error("Could not update indexDB:", error);
            });
        });

    }catch(err){
        console.error("Could not load firebase trackers", err);
        showDataSource("Firebase is unavailable. Showing saved trackers.");
    }
    finally {
    firebaseLoading = false;
}
}

showSavedTrackersLocal();

