import Utils from "./utils";
import SB from "./SB";

interface MessageListener {
    (request: any, sender: any, callback: (response: any) => void): void;
} 

class MessageHandler {
    messageListener: MessageListener;

    constructor (messageListener?: MessageListener) {
        this.messageListener = messageListener;
    }

    sendMessage(id: number, request, callback?) {
        if (this.messageListener) {
            this.messageListener(request, null, callback);
        } else {
            chrome.tabs.sendMessage(id, request, callback);
        }
    }

    query(config, callback) {
        if (this.messageListener) {
            // Send back dummy info
            callback([{
                url: document.URL,
                id: -1
            }]);
        } else {
            chrome.tabs.query(config, callback);
        }
        
    }
}

//make this a function to allow this to run on the content page
async function runThePopup(messageListener?: MessageListener) {
    var messageHandler = new MessageHandler();

    Utils.localizeHtmlPage();

    await Utils.wait(() => SB.config !== undefined);

    var OptionsElements: any = {};

    ["sponsorStart",
    // Top toggles
    "whitelistChannel",
    "unwhitelistChannel",
    "disableSkipping",
    "enableSkipping",
    // Options
    "showNoticeAgain",
    "optionsButton",
    // More controls
    "clearTimes",
    "submitTimes",
    "reportAnIssue",
    // sponsorTimesContributions
    "sponsorTimesContributionsContainer",
    "sponsorTimesContributionsDisplay",
    "sponsorTimesContributionsDisplayEndWord",
    // sponsorTimesViewsDisplay
    "sponsorTimesViewsContainer",
    "sponsorTimesViewsDisplay",
    "sponsorTimesViewsDisplayEndWord",
    // sponsorTimesOthersTimeSaved
    "sponsorTimesOthersTimeSavedContainer",
    "sponsorTimesOthersTimeSavedDisplay",
    "sponsorTimesOthersTimeSavedEndWord",
    // sponsorTimesSkipsDone
    "sponsorTimesSkipsDoneContainer",
    "sponsorTimesSkipsDoneDisplay",
    "sponsorTimesSkipsDoneEndWord",
    // sponsorTimeSaved
    "sponsorTimeSavedContainer",
    "sponsorTimeSavedDisplay",
    "sponsorTimeSavedEndWord",
    // discordButtons
    "discordButtonContainer",
    "hideDiscordButton",
    // submitTimesInfoMessage
    "submitTimesInfoMessageContainer",
    "submitTimesInfoMessage",
    // Username
    "setUsernameContainer",
    "setUsernameButton",
    "setUsernameStatusContainer",
    "setUsernameStatus",
    "setUsername",
    "usernameInput",
    "submitUsername",
    // More
    "submissionSection",
    "mainControls",
    "loadingIndicator",
    "videoFound",
    "sponsorMessageTimes",
    "downloadedSponsorMessageTimes",
    ].forEach(id => OptionsElements[id] = document.getElementById(id));

    //setup click listeners
    OptionsElements.sponsorStart.addEventListener("click", sendSponsorStartMessage);
    OptionsElements.whitelistChannel.addEventListener("click", whitelistChannel);
    OptionsElements.unwhitelistChannel.addEventListener("click", unwhitelistChannel);
    OptionsElements.disableSkipping.addEventListener("click", () => toggleSkipping(true));
    OptionsElements.enableSkipping.addEventListener("click", () => toggleSkipping(false));
    OptionsElements.clearTimes.addEventListener("click", clearTimes);
    OptionsElements.submitTimes.addEventListener("click", submitTimes);
    OptionsElements.showNoticeAgain.addEventListener("click", showNoticeAgain);
    OptionsElements.setUsernameButton.addEventListener("click", setUsernameButton);
    OptionsElements.submitUsername.addEventListener("click", submitUsername);
    OptionsElements.optionsButton.addEventListener("click", openOptions);
    OptionsElements.reportAnIssue.addEventListener("click", reportAnIssue);
    OptionsElements.hideDiscordButton.addEventListener("click", hideDiscordButton);
	
    //if true, the button now selects the end time
    let startTimeChosen = false;
  
    //the start and end time pairs (2d)
    let sponsorTimes = [];
  
    //current video ID of this tab
    let currentVideoID = null;
  
    //see if discord link can be shown
    let hideDiscordLink = SB.config.hideDiscordLink;
    if (hideDiscordLink == undefined || !hideDiscordLink) {
            let hideDiscordLaunches = SB.config.hideDiscordLaunches;
            //only if less than 10 launches
            if (hideDiscordLaunches == undefined || hideDiscordLaunches < 10) {
                OptionsElements.discordButtonContainer.style.display = null;
        
                if (hideDiscordLaunches == undefined) {
                    hideDiscordLaunches = 1;
                }
                SB.config.hideDiscordLaunches = hideDiscordLaunches + 1;
            }
    }

    //show proper disable skipping button
    let disableSkipping = SB.config.disableSkipping;
    if (disableSkipping != undefined && disableSkipping) {
        OptionsElements.disableSkipping.style.display = "none";
        OptionsElements.enableSkipping.style.display = "unset";
    }

    //if the don't show notice again variable is true, an option to 
    //  disable should be available
    let dontShowNotice = SB.config.dontShowNotice;
    if (dontShowNotice != undefined && dontShowNotice) {
        OptionsElements.showNoticeAgain.style.display = "unset";
    }

    //get the amount of times this user has contributed and display it to thank them
    if (SB.config.sponsorTimesContributed != undefined) {
        if (SB.config.sponsorTimesContributed > 1) {
            OptionsElements.sponsorTimesContributionsDisplayEndWord.innerText = chrome.i18n.getMessage("Sponsors");
        } else {
            OptionsElements.sponsorTimesContributionsDisplayEndWord.innerText = chrome.i18n.getMessage("Sponsor");
        }
        OptionsElements.sponsorTimesContributionsDisplay.innerText = SB.config.sponsorTimesContributed;
        OptionsElements.sponsorTimesContributionsContainer.style.display = "unset";

        //get the userID
        let userID = SB.config.userID;
        if (userID != undefined) {
            //there are probably some views on these submissions then
            //get the amount of views from the sponsors submitted
            Utils.sendRequestToServer("GET", "/api/getViewsForUser?userID=" + userID, function(xmlhttp) {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    let viewCount = JSON.parse(xmlhttp.responseText).viewCount;
                    if (viewCount != 0) {
                        if (viewCount > 1) {
                            OptionsElements.sponsorTimesViewsDisplayEndWord.innerText = chrome.i18n.getMessage("Segments");
                        } else {
                            OptionsElements.sponsorTimesViewsDisplayEndWord.innerText = chrome.i18n.getMessage("Segment");
                        }

                        OptionsElements.sponsorTimesViewsDisplay.innerText = viewCount;
                        OptionsElements.sponsorTimesViewsContainer.style.display = "unset";
                    }
                }
            });

            //get this time in minutes
            Utils.sendRequestToServer("GET", "/api/getSavedTimeForUser?userID=" + userID, function(xmlhttp) {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    let minutesSaved = JSON.parse(xmlhttp.responseText).timeSaved;
                    if (minutesSaved != 0) {
                        if (minutesSaved != 1) {
                            OptionsElements.sponsorTimesOthersTimeSavedEndWord.innerText = chrome.i18n.getMessage("minsLower");
                        } else {
                            OptionsElements.sponsorTimesOthersTimeSavedEndWord.innerText = chrome.i18n.getMessage("minLower");
                        }

                        OptionsElements.sponsorTimesOthersTimeSavedDisplay.innerText = getFormattedHours(minutesSaved);
                        OptionsElements.sponsorTimesOthersTimeSavedContainer.style.display = "unset";
                    }
                }
            });
        }
    }

    //get the amount of times this user has skipped a sponsor
    if (SB.config.skipCount != undefined) {
        if (SB.config.skipCount != 1) {
            OptionsElements.sponsorTimesSkipsDoneEndWord.innerText = chrome.i18n.getMessage("Sponsors");
        } else {
            OptionsElements.sponsorTimesSkipsDoneEndWord.innerText = chrome.i18n.getMessage("Sponsor");
        }

        OptionsElements.sponsorTimesSkipsDoneDisplay.innerText = SB.config.skipCount;
        OptionsElements.sponsorTimesSkipsDoneContainer.style.display = "unset";
    }

    //get the amount of time this user has saved.
    if (SB.config.minutesSaved != undefined) {
        if (SB.config.minutesSaved != 1) {
            OptionsElements.sponsorTimeSavedEndWord.innerText = chrome.i18n.getMessage("minsLower");
        } else {
            OptionsElements.sponsorTimeSavedEndWord.innerText = chrome.i18n.getMessage("minLower");
        }

        OptionsElements.sponsorTimeSavedDisplay.innerText = getFormattedHours(SB.config.minutesSaved);
        OptionsElements.sponsorTimeSavedContainer.style.display = "unset";
    }
  
    messageHandler.query({
            active: true,
            currentWindow: true
    }, onTabs);
	
    function onTabs(tabs) {
	  messageHandler.sendMessage(tabs[0].id, {message: 'getVideoID'}, function(result) {
        if (result != undefined && result.videoID) {
			  currentVideoID = result.videoID;
			  loadTabData(tabs);
        } else if (result == undefined && chrome.runtime.lastError) {
			  //this isn't a YouTube video then, or at least the content script is not loaded
			  displayNoVideo();
        }
	  });
    }
  
    function loadTabData(tabs) {
        if (!currentVideoID) {
            //this isn't a YouTube video then
            displayNoVideo();
            return;
        }
  
        //load video times for this video 
        let sponsorTimesStorage = SB.config.sponsorTimes.get(currentVideoID);
        if (sponsorTimesStorage != undefined && sponsorTimesStorage.length > 0) {
            if (sponsorTimesStorage[sponsorTimesStorage.length - 1] != undefined && sponsorTimesStorage[sponsorTimesStorage.length - 1].length < 2) {
                startTimeChosen = true;
                OptionsElements.sponsorStart.innerHTML = chrome.i18n.getMessage("sponsorEnd");
            }

            sponsorTimes = sponsorTimesStorage;

            displaySponsorTimes();

            //show submission section
            OptionsElements.submissionSection.style.display = "unset";

            showSubmitTimesIfNecessary();
        }
  
        //check if this video's sponsors are known
        messageHandler.sendMessage(
            tabs[0].id,
            {message: 'isInfoFound'},
            infoFound
        );
    }
  
    function infoFound(request) {
        if(chrome.runtime.lastError) {
            //This page doesn't have the injected content script, or at least not yet
            displayNoVideo();
            return;
        }
  
        //if request is undefined, then the page currently being browsed is not YouTube
        if (request != undefined) {
            //remove loading text
            OptionsElements.mainControls.style.display = "unset"
            OptionsElements.loadingIndicator.style.display = "none";

            if (request.found) {
                OptionsElements.videoFound.innerHTML = chrome.i18n.getMessage("sponsorFound");

                displayDownloadedSponsorTimes(request);
            } else {
                OptionsElements.videoFound.innerHTML = chrome.i18n.getMessage("sponsor404");
            }
        }

        //see if whitelist button should be swapped
        messageHandler.query({
            active: true,
            currentWindow: true
        }, tabs => {
            messageHandler.sendMessage(
                tabs[0].id,
                {message: 'isChannelWhitelisted'},
                function(response) {
                    if (response.value) {
                        OptionsElements.whitelistChannel.style.display = "none";
                        OptionsElements.unwhitelistChannel.style.display = "unset";

                        OptionsElements.downloadedSponsorMessageTimes.innerText = chrome.i18n.getMessage("channelWhitelisted");
                        OptionsElements.downloadedSponsorMessageTimes.style.fontWeight = "bold";
                    }
                });
            }
        );
    }
  
    function sendSponsorStartMessage() {
            //the content script will get the message if a YouTube page is open
            messageHandler.query({
                active: true,
                currentWindow: true
            }, tabs => {
                messageHandler.sendMessage(
                    tabs[0].id,
                    {from: 'popup', message: 'sponsorStart'},
                    startSponsorCallback
                );
            });
    }
  
    function startSponsorCallback(response) {
        let sponsorTimesIndex = sponsorTimes.length - (startTimeChosen ? 1 : 0);
  
        if (sponsorTimes[sponsorTimesIndex] == undefined) {
            sponsorTimes[sponsorTimesIndex] = [];
        }
  
        sponsorTimes[sponsorTimesIndex][startTimeChosen ? 1 : 0] = response.time;

        let localStartTimeChosen = startTimeChosen;
        SB.config.sponsorTimes.set(currentVideoID, sponsorTimes);
            //send a message to the client script
            if (localStartTimeChosen) {
                messageHandler.query({
                    active: true,
                    currentWindow: true
                }, tabs => {
                    messageHandler.sendMessage(
                        tabs[0].id,
                        {message: "sponsorDataChanged"}
                    );
                });
            }
  
        updateStartTimeChosen();
  
        //display video times on screen
        displaySponsorTimes();
  
        //show submission section
        OptionsElements.submissionSection.style.display = "unset";
  
        showSubmitTimesIfNecessary();
    }
  
    //display the video times from the array
    function displaySponsorTimes() {
        //remove all children
        while (OptionsElements.sponsorMessageTimes.firstChild) {
            OptionsElements.sponsorMessageTimes.removeChild(OptionsElements.sponsorMessageTimes.firstChild);
        }

        //add sponsor times
        OptionsElements.sponsorMessageTimes.appendChild(getSponsorTimesMessageDiv(sponsorTimes));
    }
  
    //display the video times from the array at the top, in a different section
    function displayDownloadedSponsorTimes(request) {
        if (request.sponsorTimes != undefined) {
            //set it to the message
            if (OptionsElements.downloadedSponsorMessageTimes.innerText != chrome.i18n.getMessage("channelWhitelisted")) {
                OptionsElements.downloadedSponsorMessageTimes.innerText = getSponsorTimesMessage(request.sponsorTimes);
            }

            //add them as buttons to the issue reporting container
            let container = document.getElementById("issueReporterTimeButtons");
            for (let i = 0; i < request.sponsorTimes.length; i++) {
                let sponsorTimeButton = document.createElement("button");
                sponsorTimeButton.className = "warningButton popupElement";

                let extraInfo = "";
                if (request.hiddenSponsorTimes.includes(i)) {
                    //this one is hidden
                    extraInfo = " (hidden)";
                }

                sponsorTimeButton.innerText = getFormattedTime(request.sponsorTimes[i][0]) + " to " + getFormattedTime(request.sponsorTimes[i][1]) + extraInfo;
        
                let votingButtons = document.createElement("div");
  
                let UUID = request.UUIDs[i];
  
                //thumbs up and down buttons
                let voteButtonsContainer = document.createElement("div");
                voteButtonsContainer.id = "sponsorTimesVoteButtonsContainer" + UUID;
                voteButtonsContainer.setAttribute("align", "center");
                voteButtonsContainer.style.display = "none"
  
                let upvoteButton = document.createElement("img");
                upvoteButton.id = "sponsorTimesUpvoteButtonsContainer" + UUID;
                upvoteButton.className = "voteButton popupElement";
                upvoteButton.src = chrome.extension.getURL("icons/upvote.png");
                upvoteButton.addEventListener("click", () => vote(1, UUID));
  
                let downvoteButton = document.createElement("img");
                downvoteButton.id = "sponsorTimesDownvoteButtonsContainer" + UUID;
                downvoteButton.className = "voteButton popupElement";
                downvoteButton.src = chrome.extension.getURL("icons/downvote.png");
                downvoteButton.addEventListener("click", () => vote(0, UUID));
  
                //add thumbs up and down buttons to the container
                voteButtonsContainer.appendChild(document.createElement("br"));
                voteButtonsContainer.appendChild(document.createElement("br"));
                voteButtonsContainer.appendChild(upvoteButton);
                voteButtonsContainer.appendChild(downvoteButton);
  
                //add click listener to open up vote panel
                sponsorTimeButton.addEventListener("click", function() {
                    voteButtonsContainer.style.display = "unset";
                });
  
                container.appendChild(sponsorTimeButton);
                container.appendChild(voteButtonsContainer);
  
                //if it is not the last iteration
                if (i != request.sponsorTimes.length - 1) {
                    container.appendChild(document.createElement("br"));
                    container.appendChild(document.createElement("br"));
                }
            }
        }
    }
  
    //get the message that visually displays the video times
    function getSponsorTimesMessage(sponsorTimes) {
        let sponsorTimesMessage = "";
  
        for (let i = 0; i < sponsorTimes.length; i++) {
            for (let s = 0; s < sponsorTimes[i].length; s++) {
                let timeMessage = getFormattedTime(sponsorTimes[i][s]);
                //if this is an end time
                if (s == 1) {
                    timeMessage = " to " + timeMessage;
                } else if (i > 0) {
                    //add commas if necessary
                    timeMessage = ", " + timeMessage;
                }
  
                sponsorTimesMessage += timeMessage;
            }
        }
  
        return sponsorTimesMessage;
    }
  
    //get the message that visually displays the video times
    //this version is a div that contains each with delete buttons
    function getSponsorTimesMessageDiv(sponsorTimes) {
        // let sponsorTimesMessage = "";
        let sponsorTimesContainer = document.createElement("div");
        sponsorTimesContainer.id = "sponsorTimesContainer";
  
        for (let i = 0; i < sponsorTimes.length; i++) {
            let currentSponsorTimeContainer = document.createElement("div");
            currentSponsorTimeContainer.id = "sponsorTimeContainer" + i;
            currentSponsorTimeContainer.className = "sponsorTime popupElement";
            let currentSponsorTimeMessage = "";
  
            let deleteButton = document.createElement("span");
            deleteButton.id = "sponsorTimeDeleteButton" + i;
            deleteButton.innerText = "Delete";
            deleteButton.className = "mediumLink popupElement";
            let index = i;
            deleteButton.addEventListener("click", () => deleteSponsorTime(index));
  
            let previewButton = document.createElement("span");
            previewButton.id = "sponsorTimePreviewButton" + i;
            previewButton.innerText = "Preview";
            previewButton.className = "mediumLink popupElement";
            previewButton.addEventListener("click", () => previewSponsorTime(index));
  
            let editButton = document.createElement("span");
            editButton.id = "sponsorTimeEditButton" + i;
            editButton.innerText = "Edit";
            editButton.className = "mediumLink popupElement";
            editButton.addEventListener("click", () => editSponsorTime(index));
  
            for (let s = 0; s < sponsorTimes[i].length; s++) {
                let timeMessage = getFormattedTime(sponsorTimes[i][s]);
                //if this is an end time
                if (s == 1) {
                    timeMessage = " to " + timeMessage;
                } else if (i > 0) {
                    //add commas if necessary
                    timeMessage = timeMessage;
                }
  
                currentSponsorTimeMessage += timeMessage;
            }
  
            currentSponsorTimeContainer.innerText = currentSponsorTimeMessage;
  
            sponsorTimesContainer.appendChild(currentSponsorTimeContainer);
            sponsorTimesContainer.appendChild(deleteButton);
  
            //only if it is a complete sponsor time
            if (sponsorTimes[i].length > 1) {
                sponsorTimesContainer.appendChild(previewButton);
                sponsorTimesContainer.appendChild(editButton);

                currentSponsorTimeContainer.addEventListener("click", () => editSponsorTime(index));
            }
        }
  
        return sponsorTimesContainer;
    }

    function previewSponsorTime(index) {
        let skipTime = sponsorTimes[index][0];

        if (document.getElementById("startTimeMinutes" + index) != null) {
            //edit is currently open, use that time

            skipTime = getSponsorTimeEditTimes("startTime", index);

            //save the edit
            saveSponsorTimeEdit(index, false);
        }

        messageHandler.query({
            active: true,
            currentWindow: true
        }, tabs => {
            messageHandler.sendMessage(
                tabs[0].id, {
                    message: "skipToTime",
                    time: skipTime - 2
                }
            );
        });
    }
  
    function editSponsorTime(index) {
        if (document.getElementById("startTimeMinutes" + index) != null) {
            //already open
            return;
        }

        //hide submit button
        document.getElementById("submitTimesContainer").style.display = "none";
  
        let sponsorTimeContainer = document.getElementById("sponsorTimeContainer" + index);
  
        //the button to set the current time
        let startTimeNowButton = document.createElement("span");
        startTimeNowButton.id = "startTimeNowButton" + index;
        startTimeNowButton.innerText = "(Now)";
        startTimeNowButton.className = "tinyLink popupElement";
        startTimeNowButton.addEventListener("click", () => setEditTimeToCurrentTime("startTime", index));

        //get sponsor time minutes and seconds boxes
        let startTimeMinutes = document.createElement("input");
        startTimeMinutes.id = "startTimeMinutes" + index;
        startTimeMinutes.className = "sponsorTime popupElement";
        startTimeMinutes.type = "text";
        startTimeMinutes.value = String(getTimeInMinutes(sponsorTimes[index][0]));
        startTimeMinutes.style.width = "45px";
    
        let startTimeSeconds = document.createElement("input");
        startTimeSeconds.id = "startTimeSeconds" + index;
        startTimeSeconds.className = "sponsorTime popupElement";
        startTimeSeconds.type = "text";
        startTimeSeconds.value = getTimeInFormattedSeconds(sponsorTimes[index][0]);
        startTimeSeconds.style.width = "60px";

        let endTimeMinutes = document.createElement("input");
        endTimeMinutes.id = "endTimeMinutes" + index;
        endTimeMinutes.className = "sponsorTime popupElement";
        endTimeMinutes.type = "text";
        endTimeMinutes.value = String(getTimeInMinutes(sponsorTimes[index][1]));
        endTimeMinutes.style.width = "45px";
    
        let endTimeSeconds = document.createElement("input");
        endTimeSeconds.id = "endTimeSeconds" + index;
        endTimeSeconds.className = "sponsorTime popupElement";
        endTimeSeconds.type = "text";
        endTimeSeconds.value = getTimeInFormattedSeconds(sponsorTimes[index][1]);
        endTimeSeconds.style.width = "60px";

        //the button to set the current time
        let endTimeNowButton = document.createElement("span");
        endTimeNowButton.id = "endTimeNowButton" + index;
        endTimeNowButton.innerText = "(Now)";
        endTimeNowButton.className = "tinyLink popupElement";
        endTimeNowButton.addEventListener("click", () => setEditTimeToCurrentTime("endTime", index));
  
        let colonText = document.createElement("span");
        colonText.innerText = ":";
  
        let toText = document.createElement("span");
        toText.innerText = " to ";
  
        //remove all children to replace
        while (sponsorTimeContainer.firstChild) {
            sponsorTimeContainer.removeChild(sponsorTimeContainer.firstChild);
        }
  
        sponsorTimeContainer.appendChild(startTimeNowButton);
        sponsorTimeContainer.appendChild(startTimeMinutes);
        sponsorTimeContainer.appendChild(colonText);
        sponsorTimeContainer.appendChild(startTimeSeconds);
        sponsorTimeContainer.appendChild(toText);
        sponsorTimeContainer.appendChild(endTimeMinutes);
        sponsorTimeContainer.appendChild(colonText);
        sponsorTimeContainer.appendChild(endTimeSeconds);
        sponsorTimeContainer.appendChild(endTimeNowButton);
  
        //add save button and remove edit button
        let saveButton = document.createElement("span");
        saveButton.id = "sponsorTimeSaveButton" + index;
        saveButton.innerText = "Save";
        saveButton.className = "mediumLink popupElement";
        saveButton.addEventListener("click", () => saveSponsorTimeEdit(index));
  
        let editButton = document.getElementById("sponsorTimeEditButton" + index);
        let sponsorTimesContainer = document.getElementById("sponsorTimesContainer");
  
        sponsorTimesContainer.replaceChild(saveButton, editButton);
    }

    function setEditTimeToCurrentTime(idStartName, index) {
        messageHandler.query({
            active: true,
            currentWindow: true
        }, tabs => {
            messageHandler.sendMessage(
                tabs[0].id,
                {message: "getCurrentTime"},
                function (response) {
                    let minutes =  <HTMLInputElement> <unknown> document.getElementById(idStartName + "Minutes" + index);
                    let seconds = <HTMLInputElement> <unknown> document.getElementById(idStartName + "Seconds" + index);
    
                    minutes.value = String(getTimeInMinutes(response.currentTime));
                    seconds.value = getTimeInFormattedSeconds(response.currentTime);
                });
        });
    }

    //id start name is whether it is the startTime or endTime
    //gives back the time in seconds
    function getSponsorTimeEditTimes(idStartName, index) {
        let minutes = <HTMLInputElement> <unknown> document.getElementById(idStartName + "Minutes" + index);
        let seconds = <HTMLInputElement> <unknown> document.getElementById(idStartName + "Seconds" + index);

        return parseInt(minutes.value) * 60 + seconds.value;
    }
  
    function saveSponsorTimeEdit(index, closeEditMode = true) {
        sponsorTimes[index][0] = getSponsorTimeEditTimes("startTime", index);
        sponsorTimes[index][1] = getSponsorTimeEditTimes("endTime", index);
  
        //save this
		SB.config.sponsorTimes.set(currentVideoID, sponsorTimes);
            messageHandler.query({
                active: true,
                currentWindow: true
            }, tabs => {
                messageHandler.sendMessage(
                    tabs[0].id,
                    {message: "sponsorDataChanged"}
                );
            });
  
        if (closeEditMode) {
            displaySponsorTimes();

            showSubmitTimesIfNecessary();
        }
    }
  
    //deletes the sponsor time submitted at an index
    function deleteSponsorTime(index) {
        //if it is not a complete sponsor time
        if (sponsorTimes[index].length < 2) {
            messageHandler.query({
                active: true,
                currentWindow: true
            }, function(tabs) {
                messageHandler.sendMessage(tabs[0].id, {
                    message: "changeStartSponsorButton",
                    showStartSponsor: true,
                    uploadButtonVisible: false
                });
            });
  
            resetStartTimeChosen();
        }
  
        sponsorTimes.splice(index, 1);
  
        //save this
		SB.config.sponsorTimes.set(currentVideoID, sponsorTimes);
            messageHandler.query({
                active: true,
                currentWindow: true
            }, tabs => {
                messageHandler.sendMessage(
                    tabs[0].id,
                    {message: "sponsorDataChanged"}
                );
            });
  
        //update display
        displaySponsorTimes();
  
        //if they are all removed
        if (sponsorTimes.length == 0) {
            //update chrome tab
            messageHandler.query({
                active: true,
                currentWindow: true
            }, function(tabs) {
                messageHandler.sendMessage(tabs[0].id, {
                    message: "changeStartSponsorButton",
                    showStartSponsor: true,
                    uploadButtonVisible: false
                });
            });
  
            //hide submission section
            document.getElementById("submissionSection").style.display = "none";
        }
    }
  
    function clearTimes() {
        //send new sponsor time state to tab
        if (sponsorTimes.length > 0) {
            messageHandler.query({
                active: true,
                currentWindow: true
            }, function(tabs) {
                messageHandler.sendMessage(tabs[0].id, {
                    message: "changeStartSponsorButton",
                    showStartSponsor: true,
                    uploadButtonVisible: false
                });
            });
        }
  
        //reset sponsorTimes
        sponsorTimes = [];

		SB.config.sponsorTimes.set(currentVideoID, sponsorTimes);
            messageHandler.query({
                active: true,
                currentWindow: true
            }, tabs => {
                messageHandler.sendMessage(
                    tabs[0].id,
                    {message: "sponsorDataChanged"}
                );
            });
  
        displaySponsorTimes();
  
        //hide submission section
        document.getElementById("submissionSection").style.display = "none";
  
        resetStartTimeChosen();
    }
  
    function submitTimes() {
        //make info message say loading
        OptionsElements.submitTimesInfoMessage.innerText = chrome.i18n.getMessage("Loading");
        OptionsElements.submitTimesInfoMessageContainer.style.display = "unset";
  
        if (sponsorTimes.length > 0) {
            chrome.runtime.sendMessage({
                message: "submitTimes",
                videoID: currentVideoID
            }, function(response) {
                if (response != undefined) {
                    if (response.statusCode == 200) {
                        //hide loading message
                        OptionsElements.submitTimesInfoMessageContainer.style.display = "none";

                        clearTimes();
                    } else {
                        document.getElementById("submitTimesInfoMessage").innerText = Utils.getErrorMessage(response.statusCode);
                        document.getElementById("submitTimesInfoMessageContainer").style.display = "unset";

                        OptionsElements.submitTimesInfoMessageContainer.style.display = "unset";
                    }
                }
            });
        }
    }
  
    function showNoticeAgain() {
        SB.config.dontShowNotice = false;
  
        OptionsElements.showNoticeAgain.style.display = "none";
    }

    function updateStartTimeChosen() {
        //update startTimeChosen letiable
        if (!startTimeChosen) {
            startTimeChosen = true;
            OptionsElements.sponsorStart.innerHTML = chrome.i18n.getMessage("sponsorEnd");
        } else {
            resetStartTimeChosen();
        }
    }
  
    //set it to false
    function resetStartTimeChosen() {
        startTimeChosen = false;
        OptionsElements.sponsorStart.innerHTML = chrome.i18n.getMessage("sponsorStart");
    }
  
    //hides and shows the submit times button when needed
    function showSubmitTimesIfNecessary() {
        //check if an end time has been specified for the latest sponsor time
        if (sponsorTimes.length > 0 && sponsorTimes[sponsorTimes.length - 1].length > 1) {
            //show submit times button
            document.getElementById("submitTimesContainer").style.display = "unset";
        } else {
            //hide submit times button
            document.getElementById("submitTimesContainer").style.display = "none";
        }
    }
  
    //make the options div visible
    function openOptions() {
        chrome.runtime.sendMessage({"message": "openConfig"});
    }

    //make the options username setting option visible
    function setUsernameButton() {
        //get username from the server
        Utils.sendRequestToServer("GET", "/api/getUsername?userID=" + SB.config.userID, function (xmlhttp, error) {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                OptionsElements.usernameInput.value = JSON.parse(xmlhttp.responseText).userName;

                OptionsElements.submitUsername.style.display = "unset";
                OptionsElements.usernameInput.style.display = "unset";

                OptionsElements.setUsernameContainer.style.display = "none";
                OptionsElements.setUsername.style.display = "unset";
                OptionsElements
                OptionsElements.setUsernameStatusContainer.style.display = "none";
            } else if (xmlhttp.readyState == 4) {
                OptionsElements.setUsername.style.display = "unset";
                OptionsElements.submitUsername.style.display = "none";
                OptionsElements.usernameInput.style.display = "none";

                OptionsElements.setUsernameStatusContainer.style.display = "unset";
                OptionsElements.setUsernameStatus.innerText = Utils.getErrorMessage(xmlhttp.status);
            }
        });
    }

    //submit the new username
    function submitUsername() {
        //add loading indicator
        OptionsElements.setUsernameStatusContainer.style.display = "unset";
        OptionsElements.setUsernameStatus.innerText = "Loading...";

        //get the userID
        Utils.sendRequestToServer("POST", "/api/setUsername?userID=" + SB.config.userID + "&username=" + OptionsElements.usernameInput.value, function (xmlhttp, error) {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                //submitted
                OptionsElements.submitUsername.style.display = "none";
                OptionsElements.usernameInput.style.display = "none";

                OptionsElements.setUsernameStatus.innerText = chrome.i18n.getMessage("success");
            } else if (xmlhttp.readyState == 4) {
                OptionsElements.setUsernameStatus.innerText = Utils.getErrorMessage(xmlhttp.status);
            }
        });


        OptionsElements.setUsernameContainer.style.display = "none";
        OptionsElements.setUsername.style.display = "unset";
    }

    //this is not a YouTube video page
    function displayNoVideo() {
        document.getElementById("loadingIndicator").innerText = chrome.i18n.getMessage("noVideoID");
    }
  
    function reportAnIssue() {
        document.getElementById("issueReporterContainer").style.display = "unset";
        OptionsElements.reportAnIssue.style.display = "none";
    }
  
    function addVoteMessage(message, UUID) {
        let container = document.getElementById("sponsorTimesVoteButtonsContainer" + UUID);
        //remove all children
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
  
        let thanksForVotingText = document.createElement("h2");
        thanksForVotingText.innerText = message;
        //there are already breaks there
        thanksForVotingText.style.marginBottom = "0px";
  
        container.appendChild(thanksForVotingText);
    }
  
    function vote(type, UUID) {
        //add loading info
        addVoteMessage("Loading...", UUID)
  
        //send the vote message to the tab
        chrome.runtime.sendMessage({
            message: "submitVote",
            type: type,
            UUID: UUID
        }, function(response) {
            if (response != undefined) {
                //see if it was a success or failure
                if (response.successType == 1 || (response.successType == -1 && response.statusCode == 429)) {
                    //success (treat rate limits as a success)
                    addVoteMessage(chrome.i18n.getMessage("voted"), UUID)
                } else if (response.successType == 0) {
                    //failure: duplicate vote
                    addVoteMessage(chrome.i18n.getMessage("voteFail"), UUID)
                } else if (response.successType == -1) {
                    addVoteMessage(Utils.getErrorMessage(response.statusCode), UUID)
                }
            }
        });
    }
  
    function hideDiscordButton() {
        SB.config.hideDiscordLink = true;
        OptionsElements.discordButtonContainer.style.display = "none";
    }
  
    //converts time in seconds to minutes:seconds
    function getFormattedTime(seconds) {
        let minutes = Math.floor(seconds / 60);
        let secondsDisplayNumber = Math.round(seconds - minutes * 60);
        let secondsDisplay = String(secondsDisplayNumber);
        if (secondsDisplayNumber < 10) {
            //add a zero
            secondsDisplay = "0" + secondsDisplay;
        }
  
        let formatted = minutes+ ":" + secondsDisplay;
  
        return formatted;
    }

    function whitelistChannel() {
        //get the channel url
        messageHandler.query({
            active: true,
            currentWindow: true
        }, tabs => {
            messageHandler.sendMessage(
                tabs[0].id,
                {message: 'getChannelURL'},
                function(response) {
                    //get whitelisted channels
                        let whitelistedChannels = SB.config.whitelistedChannels;
                        if (whitelistedChannels == undefined) {
                            whitelistedChannels = [];
                        }

                        //add on this channel
                        whitelistedChannels.push(response.channelURL);

                        //change button
                        OptionsElements.whitelistChannel.style.display = "none";
                        OptionsElements.unwhitelistChannel.style.display = "unset";

                        OptionsElements.downloadedSponsorMessageTimes.innerText = chrome.i18n.getMessage("channelWhitelisted");
                        OptionsElements.downloadedSponsorMessageTimes.style.fontWeight = "bold";

                        //save this
                        OptionsElements.config.whitelistedChannels = whitelistedChannels;

                        //send a message to the client
                        messageHandler.query({
                            active: true,
                            currentWindow: true
                        }, tabs => {
                            messageHandler.sendMessage(
                                tabs[0].id, {
                                    message: 'whitelistChange',
                                    value: true
                                });
                            }
                        );
                }
            );
        });
    }

    function unwhitelistChannel() {
        //get the channel url
        messageHandler.query({
            active: true,
            currentWindow: true
        }, tabs => {
            messageHandler.sendMessage(
                tabs[0].id,
                {message: 'getChannelURL'},
                function(response) {
                    //get whitelisted channels
                        let whitelistedChannels = SB.config.whitelistedChannels;
                        if (whitelistedChannels == undefined) {
                            whitelistedChannels = [];
                        }

                        //remove this channel
                        let index = whitelistedChannels.indexOf(response.channelURL);
                        whitelistedChannels.splice(index, 1);

                        //change button
                        OptionsElements.whitelistChannel.style.display = "unset";
                        OptionsElements.unwhitelistChannel.style.display = "none";

                        OptionsElements.downloadedSponsorMessageTimes.innerText = "";
                        OptionsElements.downloadedSponsorMessageTimes.style.fontWeight = "unset";

                        //save this
                        OptionsElements.config.whitelistedChannels = whitelistedChannels;

                        //send a message to the client
                        messageHandler.query({
                            active: true,
                            currentWindow: true
                        }, tabs => {
                            messageHandler.sendMessage(
                                tabs[0].id, {
                                    message: 'whitelistChange',
                                    value: false
                                });
                            }
                        );
                }
            );
        });
    }

    /**
     * Should skipping be disabled (visuals stay)
     */
    function toggleSkipping(disabled) {
		OptionsElements.config.disableSkipping = disabled;

        let hiddenButton = OptionsElements.disableSkipping;
        let shownButton = OptionsElements.enableSkipping;

        if (!disabled) {
            hiddenButton = OptionsElements.enableSkipping;
            shownButton = OptionsElements.disableSkipping;
        }

        shownButton.style.display = "unset";
        hiddenButton.style.display = "none";
    }

    //converts time in seconds to minutes
    function getTimeInMinutes(seconds) {
        let minutes = Math.floor(seconds / 60);
  
        return minutes;
    }
  
    //converts time in seconds to seconds past the last minute
    function getTimeInFormattedSeconds(seconds) {
        let minutes = seconds % 60;
        let secondsFormatted = minutes.toFixed(3);
  
        if (minutes < 10) {
            secondsFormatted = "0" + secondsFormatted;
        }
  
        return secondsFormatted;
    }
  
    /**
     * Converts time in hours to 5h 25.1
     * If less than 1 hour, just returns minutes
     * 
     * @param {float} seconds 
     * @returns {string}
     */
    function getFormattedHours(minues) {
        let hours = Math.floor(minues / 60);
        return (hours > 0 ? hours + "h " : "") + (minues % 60).toFixed(1);
    }
  
//end of function
}

if (chrome.tabs != undefined) {
    //add the width restriction (because Firefox)
    let link = <HTMLLinkElement> document.getElementById("sponsorBlockStyleSheet");
    (<CSSStyleSheet> link.sheet).insertRule('.popupBody { width: 325 }', 0);

    //this means it is actually opened in the popup
    runThePopup();
}

export default runThePopup;