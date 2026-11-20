
import { 
    watchTrackers,
    synchronizePendingChanges
} from "./tracker-service.js";

import { 
    deleteTrackAndQueue, 
    saveTrackAndQueue, 
    readAllTrackers, 
    mergeServerTrackers
 } from "./idb-Storage.js";

    //service worker registration
    if("serviceWorker" in navigator){
        window.addEventListener("load", async() =>{
            try{
                const registration = await navigator.serviceWorker.register("/sw.js",
                    { scope: "/" }
                );
                console.log("Story Submission Tracker service worker registered", registration.scope);
            }catch(error){
                console.error("Story Submission Tracker registration failed;", error);
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

   if (installButton) {

    installButton.addEventListener("click", async () => {

        if (!installPrompt) return;

        const deferredPrompt = installPrompt;

        installPrompt = null;

        await deferredPrompt.prompt();

        const result = await deferredPrompt.userChoice;

        console.log("Install choice:", result.outcome);

        installButton.hidden = true;
    });

}
    

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  console.log("FieldSync was installed.");
});

//connect html and javascript
const formMarket = document.querySelector("#add-market-form");
const formStory = document.querySelector("#add-story-form");

const list = document.querySelector("#dash-list");
const statusMessage = document.querySelector("#list-status");

const magazine = document.querySelector("#magazine-list");
const contest = document.querySelector("#contest-list");
const publisher = document.querySelector("#publisher-list");
const story = document.querySelector("#story-list");
const recentContainer = document.querySelector("#recent-submissions");
const wordCount = document.querySelector("#word-count");
const countBadge = document.querySelector("#tracker-count");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-tracker");
const cancelEditButton = document.querySelector("#cancel-edit");
const trackerFormPanel = document.querySelector("#tracker-form");

const editingTrackerIds = {
    market: null,
    story: null
};
let currentTrackers = [];
const dataSource = document.querySelector("#data-source");
let serverSnapshotRecieved = false;
let firebaseListenerStarted = false;
let firebaseLoading = false;

function showDataSource(message){
    if(dataSource) dataSource.textContent = message;
}

function cancelEditOnline(id) {
    for (const form of forms) {
        const type = getFormType(form);

        if (editingTrackerIds[type] === id) {
            resetFormToCreateMode(form);
        }
    }

    return true;
}
function toLocalTracker(item){
    
    return {
        id: item.id,
        title: item.title || "",
        category: item.category || "other",
        genre: item.genre || "",
        website: item.website || "",
        email: item.email || "",
        address: item.address || "",
        wordCount: item.wordCount || "",
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
function escapeHTML(value = ""){
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



// form results for individual pages




function renderTrackers(trackers) {
    currentTrackers = trackers || [];

    Object.entries(trackerSections).forEach(
        ([sectionKey, section]) => {

            const { list, status, count, label } = section;

            // Count only submissions belonging to this category
            const filteredTrackers = currentTrackers
                .filter(item => item.category === sectionKey)
                .sort((a, b) =>
                    (b.createdAtMs || 0) - (a.createdAtMs || 0)
                );

            // Update category-specific count
            if (count) {
                count.textContent = filteredTrackers.length;
            }

            if (!list) return;

            list.innerHTML = "";

            if (filteredTrackers.length === 0) {
                const emptyMessage = document.createElement("p");

                emptyMessage.textContent =
                    `No ${label.toLowerCase()} submissions yet. Add your first submission.`;

                list.appendChild(emptyMessage);
                return;
            }

            if (status) status.hidden = true;

            filteredTrackers.forEach(item => {
                const li = document.createElement("li");

                li.className = "collection-item tracker-item";

                li.innerHTML = `
                    <div class="row valign-wrapper no-margin-bottom">
                        <div class="col s8">
                            <h6 class="black-text">
                                ${escapeHTML(item.title)}
                            </h6>
                            <p class="grey-text text-darken-1">
                                ${escapeHTML(item.email || "")}
                            </p>
                            <p class="grey-text text-darken-1">
                                ${escapeHTML(item.website || "")}
                            </p>
                            <p class="grey-text text-darken-1">
                                ${escapeHTML(item.notes || "No description")}
                            </p>
                            <small class="grey-text">
                                ${escapeHTML(item.address || "No address")}
                            </small>
                            <br>
                            <small class="grey-text">
                                Submitted:
                                ${escapeHTML(formatTimestamp(item.createdAtMs))}
                            </small>
                        </div>

                        <div class="col s4 right-align">
                            <button
                                class="btn-flat edit-btn"
                                type="button"
                                data-id="${escapeHTML(item.id)}"
                                aria-label="Edit tracker">
                                <i class="material-icons blue-text">edit</i>
                            </button>

                            <button
                                class="btn-flat delete-btn"
                                type="button"
                                data-id="${escapeHTML(item.id)}"
                                aria-label="Delete tracker">
                                <i class="material-icons red-text">delete</i>
                            </button>
                        </div>
                    </div>
                `;

                list.appendChild(li);
            });
        }
    );

    displayRecentSubmissions(
        document.querySelector("#recent-category")?.value || "story"
    );
}


const trackerSections = {
    publisher: {
        list: publisher,
        count:document.querySelector("#publisher-count"),
        label: "Publisher"
    },
    magazine: {
        list: magazine,
        count:document.querySelector("#magazine-count"),
        label: "Magazine"
    },
    contest: {
        list: contest,
        count:document.querySelector("#contest-count"),
        label: "Contest"
    },
    story: {
        list: story,
        count:document.querySelector("#story-count"),
        label: "Story"
    }
};


function getFormType(form) {
    return form === formMarket ? "market" : "story";
}

function resetFormToCreateMode(form) {
    const type = getFormType(form);

    editingTrackerIds[type] = null;

    form.reset();

    const title = form.querySelector("#form-title");
    const save = form.querySelector("#save-tracker");
    const cancel = form.querySelector("#cancel-edit");

    if (title) title.textContent = "Add New Tracker";

    if (save) {
        save.innerHTML =
            'Add Tracker <i class="material-icons right">save</i>';
    }

    if (cancel) cancel.hidden = true;

    if (typeof M !== "undefined") {
        M.updateTextFields();
    }
}

function startEdit(id, form) {
    const type = getFormType(form);

    const tracker = currentTrackers.find(
        item => item.id === id
    );

    if (!tracker) return;

    editingTrackerIds[type] = id;

    form.querySelector("#title").value = tracker.title || "";
    form.querySelector("#category").value = tracker.category || "";
    form.querySelector("#genre").value = tracker.genre || "";
    form.querySelector("#website").value = tracker.website || "";
    form.querySelector("#email").value = tracker.email || "";
    form.querySelector("#address").value = tracker.address || "";
    form.querySelector("#wordCount").value = tracker.wordCount || "";
    form.querySelector("#description").value = tracker.notes || "";

    const title = form.querySelector("#form-title");
    const save = form.querySelector("#save-tracker");
    const cancel = form.querySelector("#cancel-edit");

    if (title) title.textContent = "Edit Tracker";

    if (save) {
        save.innerHTML =
            'Save Changes <i class="material-icons right">save</i>';
    }

    if (cancel) cancel.hidden = false;

    if (typeof M !== "undefined") {
        M.updateTextFields();

        const categorySelect = form.querySelector("#category");

        if (categorySelect) {
            const instance =
                M.FormSelect.getInstance(categorySelect);

            if (instance) instance.destroy();

            M.FormSelect.init(categorySelect);
        }
    }
}

//Connection form



const forms = [formMarket, formStory].filter(Boolean);


forms.forEach(form => {

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const type = getFormType(form);
        const editingId = editingTrackerIds[type];

        const existing = currentTrackers.find(
            item => item.id === editingId
        );

        const now = Date.now();

        const tracker = {
            id: editingId || makeLocalId(),

            title: form.querySelector("#title")?.value.trim() || "",
            category: form.querySelector("#category")?.value.trim() || "",
            genre: form.querySelector("#genre")?.value.trim() || "",
            website: form.querySelector("#website")?.value.trim() || "",
            email: form.querySelector("#email")?.value.trim() || "",
            address: form.querySelector("#address")?.value.trim() || "",
            wordCount: form.querySelector("#wordCount")?.value.trim() || "",
            notes: form.querySelector("#description")?.value.trim() || "",

            status: existing?.status || "active",

            createdAtMs: existing?.createdAtMs || now,
            updatedAtMs: now
        };

        const saveButton = form.querySelector("#save-tracker");

        try {
            if (saveButton) saveButton.disabled = true;

            await saveTrackAndQueue(
                tracker,
                editingId ? "update" : "create"
            );

            await refreshLocalList();
            if (navigator.onLine) {
            void synchronizePendingChanges();
            }
            

            showToast(
                "Tracker saved on this device. It will sync when online."
            );

            resetFormToCreateMode(form);

        } catch (error) {
            console.error("Could not save tracker:", error);

            showToast("Could not save tracker.");

        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    });

});

//Display forms on dashboard

function displayRecentSubmissions(formType) {

    if (!recentContainer) return;

    const filtered = currentTrackers
        .filter(item => item.category === formType)
        .sort((a, b) =>
            (b.createdAtMs || 0) - (a.createdAtMs || 0)
        )
        .slice(0, 5);

    if (filtered.length === 0) {
        recentContainer.innerHTML = `
            <li class="collection-item">
                No recent ${formType} submissions found.
            </li>
        `;
        return;
    }

    recentContainer.innerHTML = filtered.map(item => `
        <li class="collection-item">
            <strong>${escapeHTML(item.title)}</strong>
            <p>${escapeHTML(item.notes || "No description")}</p>
            <small>
                Submitted: ${escapeHTML(
                    formatTimestamp(item.createdAtMs)
                )}
            </small>
        </li>
    `).join("");
}

const recentCategory = document.querySelector("#recent-category");

if (recentCategory) {
    recentCategory.addEventListener("change", () => {
        displayRecentSubmissions(recentCategory.value);
    });
}

async function refreshLocalList() {
    try {
        const trackers = await readAllTrackers();

        renderTrackers(trackers);

    } catch (error) {
        console.error("Could not load trackers:", error);
        showToast("Could not load saved trackers.");
    }
}

forms.forEach(form => {
    const cancelButton = form.querySelector("#cancel-edit");
    cancelButton?.addEventListener("click", () => {
        resetFormToCreateMode(form);
    });
});

   
document.addEventListener("click", async (event) => {

    if (!(event.target instanceof Element)) return;
    // EDIT BUTTON
    const editButton = event.target.closest(".edit-btn");

    if (editButton) {

        const tracker = currentTrackers.find(
            item => item.id === editButton.dataset.id
        );

        if (!tracker) return;

        const form = [
            "publisher",
            "magazine",
            "contest"
        ].includes(tracker.category)
            ? formMarket
            : formStory;

        if (!form) return;

        startEdit(tracker.id, form);

        return;
    }

    // DELETE BUTTON
    const deleteButton = event.target.closest(".delete-btn");

    if (!deleteButton) return;

    const id = deleteButton.dataset.id;

    const tracker = currentTrackers.find(
        item => item.id === id
    );

    if (!tracker) {
        showToast("Tracker could not be found.");
        return;
    }

    // Ask for confirmation first.
    if (!window.confirm(
        `Delete ${tracker.title || "this tracker"}?`
    )) {
        return;
    }

    // Cancel editing only if this is the tracker
    // currently being edited.
    cancelEditOnline(id);

    try {

        deleteButton.disabled = true;

        // Delete locally and queue the operation.
        await deleteTrackAndQueue(id);

        // Refresh the interface.
        await refreshLocalList();

            showToast(
            navigator.onLine
                ? "Tracker deleted locally. Synchronization started."
                : "Tracker deleted on this device. It will sync when you're online."
        );

        // Start synchronization immediately.
        if (navigator.onLine) {
            void synchronizePendingChanges();
        }

    } catch (error) {

        console.error(
            "Could not delete tracker:",
            error
        );

        showToast("Could not delete the tracker.");

        deleteButton.disabled = false;
    }

});


async function showSavedTrackersLocal() {

    try {

        const saved = await readAllTrackers();

        if (!serverSnapshotRecieved) {

            renderTrackers(saved);

            if (!navigator.onLine) {

                showDataSource(
                    "Offline: showing trackers saved on this device."
                );

            } else if (saved.length) {

                showDataSource(
                    "Showing saved trackers from this device."
                );

            } else {

                showDataSource(
                    "No trackers saved on this device yet."
                );

            }
        }

    } catch (error) {

        console.error(
            "Could not read IndexedDB:",
            error
        );

        showDataSource(
            "Local storage could not be opened."
        );
    }
}

async function startApp() {
    await showSavedTrackersLocal();

    try {
        watchTrackers(
            async (remoteTrackers, metadata) => {
                try {
                    const merged = await mergeServerTrackers(
                        remoteTrackers.map(toLocalTracker),
                        metadata.fromCache
                    );

                    renderTrackers(merged);

                    serverSnapshotRecieved = !metadata.fromCache;

                    showDataSource(
                        metadata.fromCache
                            ? "Showing saved records while Firestore checks for updates."
                            : "Showing the latest Firestore records and local changes."
                    );

                    
                } catch (error) {
                    console.error("Could not merge trackers:", error);
                }
            },

            error => {
                console.error("Could not listen to Firestore:", error);

                showDataSource(
                    "Firestore unavailable. Showing locally saved trackers."
                );
            }
        );

    } catch (error) {
        console.error("Could not start Firestore listener:", error);
    }

    if (navigator.onLine) {
        void synchronizePendingChanges();
    }
}






void startApp();


