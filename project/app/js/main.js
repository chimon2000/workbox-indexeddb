/*
Copyright 2018 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { Workbox } from "https://storage.googleapis.com/workbox-cdn/releases/4.0.0/workbox-window.prod.mjs";
import { openDb } from "https://unpkg.com/idb@3.0.2/lib/idb.mjs";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    await registerServiceWorker();
  });
}

const registerServiceWorker = async () => {
  try {
    const wb = new Workbox("/sw.js");

    wb.addEventListener("installed", event => {
      if (event.isUpdate) {
        if (confirm(`New content is available!. Click OK to refresh`)) {
          window.location.reload();
        }
      }
    });

    wb.register();

    console.log(`Service Worker registered! Scope: ${registration.scope}`);

    return wb;
  } catch (err) {
    console.log(`Service Worker registration failed: ${err}`);

    return null;
  }
};

const container = document.getElementById("container");
const offlineMessage = document.getElementById("offline");
const noDataMessage = document.getElementById("no-data");
const dataSavedMessage = document.getElementById("data-saved");
const saveErrorMessage = document.getElementById("save-error");
const addEventButton = document.getElementById("add-event-button");

addEventButton.addEventListener("click", addAndPostEvent);

Notification.requestPermission();

async function createDb() {
  const dbPromise = openDb("dashboardr", 1, upgradeDB => {
    if (!upgradeDB.objectStoreNames.contains("events")) {
      const eventsOS = upgradeDB.createObjectStore("events", { keyPath: "id" });
    }
  });

  return dbPromise;
}

const dbPromise = createDb();

const dashboardrService = {
  async saveEventDataLocally(events) {
    const db = await dbPromise;

    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");

    try {
      await Promise.all(events.map(event => store.put(event)));
    } catch (error) {
      tx.abort();
      throw Error("Events were not added to the store");
    }
  },
  async getLocalEventData() {
    const db = await dbPromise;
    const tx = db.transaction("events", "readonly");
    const store = tx.objectStore("events");

    return store.getAll();
  }
};

// TODO - create indexedDB database

loadContentNetworkFirst();

function loadContentNetworkFirst() {
  getServerData()
    .then(async dataFromNetwork => {
      updateUI(dataFromNetwork);

      try {
        await dashboardrService.saveEventDataLocally(dataFromNetwork);
        setLastUpdated(new Date());
        messageDataSaved();
      } catch (error) {
        messageSaveError();
        console.warn(error);
      }
    })
    .catch(async err => {
      // if we can't connect to the server...
      console.log("Network requests have failed, this is expected if offline");
      const offlineData = await dashboardrService.getLocalEventData();
      if (!offlineData.length) {
        messageNoData;
      } else {
        messageOffline();
        updateUI(offlineData);
      }
    });
}

/* Network functions */

function getServerData() {
  return fetch("api/getAll").then(response => {
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return response.json();
  });
}

function addAndPostEvent(e) {
  e.preventDefault();
  const data = {
    id: Date.now(),
    title: document.getElementById("title").value,
    date: document.getElementById("date").value,
    city: document.getElementById("city").value,
    note: document.getElementById("note").value
  };
  updateUI([data]);

  // TODO - save event data locally
  dashboardrService.saveEventDataLocally([data]);

  const headers = new Headers({ "Content-Type": "application/json" });
  const body = JSON.stringify(data);
  return fetch("api/add", {
    method: "POST",
    headers: headers,
    body: body
  });
}

/* UI functions */

function updateUI(events) {
  events.forEach(event => {
    const item = `<li class="card">
         <div class="card-text">
           <h2>${event.title}</h2>
           <h4>${event.date}</h4>
           <h4>${event.city}</h4>
           <p>${event.note}</p>
         </div>
       </li>`;
    container.insertAdjacentHTML("beforeend", item);
  });
}

function messageOffline() {
  // alert user that data may not be current
  const lastUpdated = getLastUpdated();
  if (lastUpdated) {
    offlineMessage.textContent += " Last fetched server data: " + lastUpdated;
  }
  offlineMessage.style.display = "block";
}

function messageNoData() {
  // alert user that there is no data available
  noDataMessage.style.display = "block";
}

function messageDataSaved() {
  // alert user that data has been saved for offline
  const lastUpdated = getLastUpdated();
  if (lastUpdated) {
    dataSavedMessage.textContent += " on " + lastUpdated;
  }
  dataSavedMessage.style.display = "block";
}

function messageSaveError() {
  // alert user that data couldn't be saved offline
  saveErrorMessage.style.display = "block";
}

/* Storage functions */

function getLastUpdated() {
  return localStorage.getItem("lastUpdated");
}

function setLastUpdated(date) {
  localStorage.setItem("lastUpdated", date);
}
