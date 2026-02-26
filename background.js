// background.js

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html")
    });
});

console.log("Background service worker running.");
