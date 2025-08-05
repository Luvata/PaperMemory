/**
 * TODO: docstrings
 * TODO: miniquery for content_script.js
 *
 * TODO: add advanced option to customize storage folder
 */

/**
 * Get a the HTML string listing all the <option>tag</option> of all known tags,
 * setting the <option>'s "selected" attribute according to the paper's own tags
 * @param {object} paper The paper whose options' HTML string are being created
 * @returns {string} The HTML string of the paper's options
 */
const getTagsOptions = (paper) => {
    const tags = new Set(paper.tags);

    return [...global.state.paperTags]
        .sort()
        .map((t, i) => {
            let h = '<option value="' + t + '"'; // not string literal here for minification
            if (tags.has(t)) {
                h += ' selected="selected" ';
            }
            return h + `>${t}</option>`;
        })
        .join("");
};

const toggleTagsCollapse = (on) => {
    if (on) {
        if (!!findEl({ element: "tags-list-container" })) return;
        const contents = /*html*/ `
            <ul id="all-tags-list">
                ${[...global.state.paperTags]
                    .map((t) => /*html*/ `<li class="memory-tag" >${t}</li>`)
                    .join("")}
            </ul>`;
        const details = /*html*/ `
            <div id="tags-list-container">
                <details id="tags-list-details" style="outline: none !important;">
                    <summary style="font-size: 0.85rem; color: #5f5f5f;">Tags list</summary>
                    ${contents}
                </details>
            </div>`;
        findEl({ element: "memory-filters" }).insertAdjacentHTML("afterend", details);
    } else {
        findEl({ element: "tags-list-container" })?.remove();
    }
};
/**
 * Updates all the papers' options HTML list
 */
const updateAllMemoryPaperTagOptions = () => {
    for (const id in global.state.papers) {
        if (global.state.papers.hasOwnProperty(id) && id !== "__dataVersion") {
            const paper = global.state.papers[id];
            setHTML(`memory-item-tags--${id}`, getTagsOptions(paper));
        }
    }
};

const sampleAsciiArt = async () => {
    const artPath = chrome.runtime.getURL("src/data/art.json");
    const art = await fetch(artPath).then((res) => res.json());
    const nArts = Object.keys(art).length;
    const u = Math.floor(Math.random() * nArts);
    const [animal, ascii] = Object.entries(art)[u];
    return { animal, ascii };
};

const updatePopupPaperNoMemory = async (url) => {
    let { animal, ascii } = await sampleAsciiArt();

    let noPaperHtml = /* html */ `
        <div class="no-paper-div">
            <h3>This paper is not in your Memory&nbsp;
            <span id="no-paper-why-span">
                <button class="code-font" id="no-paper-why-code">?</button>
            </span>
            </h3>
            <div>
                <div>Here's a ${animal} for your trouble</div><br>
                <div id="ascii-art-div"><div style="text-align:">${ascii}</div></div>
            </div>
        </div>
    `;
    const isFirefox = navigator.userAgent.search("Firefox") > -1;
    const allowManualParsing = isFirefox || global.state.prefs.checkNoAuto;
    let ff_warning = "";
    if (isFirefox) {
        ff_warning = /* html */ `
            <div id="ff-warning">
                Firefox does not support content scripts on PDFs.<br/>
                Use the button below to parse this paper.<br/>
            </div>
        `;
    }
    if (allowManualParsing) {
        noPaperHtml += /* html */ `
            <div id="manual-trigger-wrapper">
                ${ff_warning}
                <div id="manual-trigger-btn">Try manual trigger</div>
                <div id="manual-loader-container" class="pm-container" style='display: none;'>
                    <div class="sk-folding-cube">
                        <div class="sk-cube1 sk-cube"></div>
                        <div class="sk-cube2 sk-cube"></div>
                        <div class="sk-cube4 sk-cube"></div>
                        <div class="sk-cube3 sk-cube"></div>
                    </div>
                </div>
                <div id="manual-parsing-error"></div>
            </div>
        `;
    }
    const previousIsArxiv = findEl({ element: "isArxiv" }).innerHTML;
    setHTML("isArxiv", noPaperHtml);

    addListener("no-paper-why-code", "click", () => {
        showPopupModal("noPaper");
    });

    if (allowManualParsing) {
        addListener("manual-trigger-btn", "click", async () => {
            showId("manual-loader-container");
            try {
                const is = await isPaper(url);
                let paper;
                const update = await addOrUpdatePaper({ url, is });
                if (update) {
                    paper = update.paper;
                } else {
                    return;
                }
                if (paper) {
                    hideId("manual-loader-container");
                    setHTML("isArxiv", previousIsArxiv);
                    popupMain(url, is, true);
                }
            } catch (error) {
                hideId("manual-loader-container");
                const errorText =
                    "There was an issue parsing this paper. <br/> " +
                    "Raise an issue on Github if you think it is a bug.<br/>" +
                    "Attempted url: " +
                    url;
                setHTML("manual-parsing-error", `<strong>${errorText}</strong>`);
                warn("Manual Parsing Error:", error);
            }
        });
    }
};

/**
 * Delete a paper ; display a modal first to get uer confirmation
 * @param {string} id Id of the paper to delete
 */
const showConfirmDeleteModal = (id) => {
    const title = global.state.papers[id].title;
    setTextId("delete-modal-title", title);
    setHTML("delete-paper-modal-hidden-id", id);
    showId("delete-paper-modal", "flex");
};

/**
 * Copy a text to the clipboard and display a feedback text
 * @param {string} id Id of the paper to display the feedback in the memory item
 * @param {string} textToCopy Text to copy to the clipboard
 * @param {string} feedbackText Text to display as feedback
 * @param {string} context The context in which the action took place: "popup" or "memory" (or "content_script")
 * @param {string} hyperLinkTitle The title of the hyperlink to copy to the clipboard
 */
const copyAndConfirmMemoryItem = async ({
    id,
    textToCopy,
    feedbackText,
    context = "popup",
    hyperLinkTitle = null,
}) => {
    if (!hyperLinkTitle) {
        copyTextToClipboard(textToCopy);
    } else {
        await copyHyperLinkToClipboard(textToCopy, hyperLinkTitle);
    }
    const element =
        context === "popup"
            ? findEl({ element: "popup-feedback-copied" })
            : context === "memory"
            ? findEl({ paperId: id, memoryItemClass: "memory-item-feedback" })
            : null;
    if (!element) return;
    element.innerText = feedbackText;
    fadeIn(element);
    setTimeout(() => {
        fadeOut(element);
    }, 2000);
};

/**
 * Looks for an open tab with the code of the paper. Matches are not exact:
 * a tab url needs only to include the targetURL to be valid. If no existing
 * tab matches the targetURL, a new tab is created
 * @param {string} targetURL URL of the page to open
 */
const focusExistingOrCreateNewURLTab = (targetURL) =>
    new Promise((resolve) => {
        targetURL = targetURL.replace("http://", "https://");
        if (!targetURL.startsWith("https://")) {
            targetURL = "https://" + targetURL;
        }
        if (!chrome.tabs) {
            if (window?.location?.href) {
                window.location.href = targetURL;
            }
            return resolve();
        }
        const { origin } = new URL(targetURL);
        chrome.tabs.query({ url: `${origin}/*` }, (tabs) => {
            for (const tab of tabs) {
                if (tab.url.includes(targetURL)) {
                    const tabUpdateProperties = { active: true };
                    const windowUpdateProperties = { focused: true };
                    chrome.windows.getCurrent((w) => {
                        if (w.id !== tab.windowId) {
                            chrome.windows.update(
                                tab.windowId,
                                windowUpdateProperties,
                                () => {
                                    chrome.tabs.update(tab.id, tabUpdateProperties);
                                    resolve();
                                }
                            );
                        } else {
                            chrome.tabs.update(tab.id, tabUpdateProperties);
                            resolve();
                        }
                    });
                    resolve();
                    return;
                }
            }
            chrome.tabs.create({ url: targetURL });
            resolve();
        });
        resolve();
    });

/**
 * Looks for an open tab to the paper: either its local or online pdf, or html page.
 * If both a local pdf tab exists, focus it.
 * Otherwise, if a remote pdf tab exists, focus it.
 * Otherwise, if an html page exist, focus the it.
 * If none exist, create a new tab to the local file if it exists, to the online pdf otherwise.
 * @param {object} paper The paper whose pdf should be opened
 */
const focusExistingOrCreateNewPaperTab = async (paper, fromMemoryItem) => {
    if (!chrome.tabs) {
        focusExistingOrCreateNewURLTab(
            isPdfUrl(window.location.href) ? paperToAbs(paper) : paperToPDF(paper)
        );
        return;
    }
    chrome.tabs.query({}, async (tabs) => {
        // find user's preferences
        const prefs = global.state.prefs;

        let paperTabs = []; // tabs to the paper
        for (const tab of tabs) {
            let tabPaperId;
            try {
                // try and parse a paper id
                tabPaperId = tab.url && (await parseIdFromUrl(tab.url));
            } catch (error) {}

            if (tabPaperId && tabPaperId === paper.id) {
                // an id is found and its the paper's: store the tab
                paperTabs.push(tab);
            }
        }

        let tabToFocus;
        // choose favorite tabs
        const favoriteTabs = prefs.checkPreferPdf
            ? paperTabs.filter((tab) => tab.url && isPdfUrl(tab.url))
            : paperTabs.filter((tab) => tab.url && !isPdfUrl(tab.url));

        if (favoriteTabs.length > 0) {
            // favor tabs to local files
            const fileTabs =
                fromMemoryItem && global.state.files.hasOwnProperty(paper.id)
                    ? []
                    : paperTabs.filter((tab) => tab.url.startsWith("file://"));
            if (fileTabs.length > 0) {
                tabToFocus = fileTabs[0];
            } else {
                tabToFocus = favoriteTabs[0];
            }
        } else if (paperTabs.length > 0) {
            // no pdf tab: go to abs url
            tabToFocus = paperTabs[0];
        }

        if (tabToFocus) {
            // a tab was found: focus it by starting to focus its window
            chrome.windows.getCurrent((w) => {
                if (w.id !== tabToFocus.windowId) {
                    // tab is in a different window: focus the window
                    chrome.windows.update(
                        tabToFocus.windowId,
                        { focused: true },
                        () => {
                            // focus the tab
                            chrome.tabs.update(tabToFocus.id, { active: true });
                        }
                    );
                } else {
                    // tab is in the same window: focus the tab
                    chrome.tabs.update(tabToFocus.id, { active: true });
                }
            });
        } else {
            // no tab was found
            const hasFile = global.state.files.hasOwnProperty(paper.id);
            if (hasFile && !fromMemoryItem) {
                // this paper has a local file
                chrome.downloads.open(global.state.files[paper.id].id);
            } else {
                // no tab open or local file: open a new tab to the paper's pdf
                chrome.tabs.create({
                    url: prefs.checkPreferPdf ? paperToPDF(paper) : paperToAbs(paper),
                });
            }
        }

        global.state.papers[paper.id] = updatePaperVisits(
            global.state.papers[paper.id]
        );
        chrome.storage.local.set({ papers: global.state.papers });
    });
};

/**
 * Trim then save in chrome.storage.local the content of the note for a paper.
 * Also updates this paper's memory table display and the main popup's textarea
 * (if the paper being edited from the memory is actually the one currently opened
 * and which is therefore being displayed by the popup)
 * @param {string} id The id of the paper whose note is being saved
 * @param {string} note The content of the note
 */
const saveNote = (id, note) => {
    global.state.papers[id].note = note;
    chrome.storage.local.set({ papers: global.state.papers }, () => {
        setHTML(
            findEl({ paperId: id, memoryItemClass: "memory-note-div" }),
            note
                ? /*html*/ ` <div class="memory-note-div memory-item-faded">
                      <span class="note-content-header">Note:</span>
                      <span class="note-content">${note}</span>
                  </div>`
                : /*html*/ `<div class="memory-note-div memory-item-faded"></div>`
        );
        const textarea = findEl({ element: `popup-form-note-textarea--${id}` });
        val(textarea, note);
        val(findEl({ paperId: id, memoryItemClass: "form-note-textarea" }), note);
    });
};

/**
 * Trim then save in chrome.storage.local the code link for a paper.
 * Also updates this paper's memory table display and the main popup's code input
 * (if the paper being edited from the memory is actually the one currently opened
 * and which is therefore being displayed by the popup)
 * @param {string} id The id of the paper whose code is being saved
 * @param {string} codeLink The link to the paper's code
 */
const saveCodeLink = (id, codeLink) => {
    codeLink = codeLink.trim();
    global.state.papers[id].codeLink = codeLink;
    chrome.storage.local.set({ papers: global.state.papers }, () => {
        const displayLink = codeLink.replace(/^https?:\/\//, "");
        setHTML(
            findEl({ paperId: id, memoryItemClass: "memory-code-link" }),
            displayLink
        );
        setHTML(`popup-code-link`, displayLink);
        val(findEl({ paperId: id, memoryItemClass: "form-code-input" }), codeLink);
        codeLink ? showId("popup-code-link") : hideId("popup-code-link");
        const codeInput = findEl({ element: `popup-form-codeLink--${id}` });
        val(codeInput, codeLink);
    });
};

const saveFavoriteItem = (id, favorite) => {
    global.state.papers[id].favorite = favorite;
    global.state.papers[id].favoriteDate = new Date().toJSON();
    chrome.storage.local.set({ papers: global.state.papers }, () => {
        // log(`${global.state.papers[id].title} is favorite: ${favorite}`);
        if (favorite) {
            addClass(`memory-container--${id}`, "favorite");
            addClass(
                findEl({
                    paperId: id,
                    memoryItemClass: "memory-item-favorite",
                }).querySelector("svg"),
                "favorite"
            );
        } else {
            removeClass(`memory-container--${id}`, "favorite");
            removeClass(
                findEl({
                    paperId: id,
                    memoryItemClass: "memory-item-favorite",
                }).querySelector("svg"),
                "favorite"
            );
        }

        if (global.state.sortKey === "favoriteDate") {
            if (!favorite) {
                sortMemory();
                displayMemoryTable();
            }
            const n = global.state.sortedPapers.filter((p) => p.favorite).length;
            const memSearch = findEl({ element: "memory-search" });
            if (memSearch) {
                setPlaceholder(memSearch, `Search ${n} entries`);
            }
        }

        let checkFavorite = findEl({ element: `checkFavorite--${id}` });
        if (checkFavorite) {
            checkFavorite.checked = favorite;
        }
    });
};

/**
 * Function to change the html content of #memory-sort-arrow to an up or down arrow
 * @param {string} direction up/down string to change the arrow's direction
 */
const setMemorySortArrow = (direction) => {
    // Handle both old popup design and new fullMemory design
    const arrowElement = document.getElementById("memory-sort-arrow") || 
                        document.getElementById("memory-sort-toggle");
    
    if (!arrowElement) return;
    
    if (arrowElement.id === "memory-sort-toggle") {
        // New fullMemory design - just update the button class and content
        const sortArrow = arrowElement.querySelector(".sort-arrow");
        if (sortArrow) {
            // Clear existing classes
            arrowElement.classList.remove("asc", "desc");
            
            if (direction === "up") {
                arrowElement.classList.add("asc");
                sortArrow.innerHTML = "↑";
            } else {
                arrowElement.classList.add("desc");
                sortArrow.innerHTML = "↓";
            }
        }
    } else {
        // Original popup design with SVG
        let arrow;
        if (direction === "up") {
            arrow = /*html*/ `<svg
                viewBox="0 0 24 24"
                class="memory-sort-arrow-svg"
                id="memory-sort-arrow-up"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="16" y1="9" x2="12" y2="5" />
                <line x1="8" y1="9" x2="12" y2="5" />
            </svg>`;
        } else {
            arrow = /*html*/ `<svg
                class="memory-sort-arrow-svg"
                id="memory-sort-arrow-down"
                viewBox="0 0 24 24"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="16" y1="15" x2="12" y2="19" />
                <line x1="8" y1="15" x2="12" y2="19" />
            </svg>`;
        }
        setHTML("memory-sort-arrow", arrow);
    }
};

/**
 * Reverses the global.state's 2 ordered lists: sortedPapers and papersList
 */
const reverseMemory = () => {
    global.state.sortedPapers.reverse();
    global.state.papersList.reverse();
};

/**
 * Function to filter the sortedPapers list into papersList, keeping papers whose
 * title, author or note includes all the words in the query.
 * e.g.: "cli ga" will look for all papers for which either their note, authors or title
 *        contains both the strings "cli" and "ga".
 * @param {string} letters The user's string query.
 */
const searchMemory = (letters) => {
    const words = letters.toLowerCase().split(" ");
    let papersList = [];
    const contentKeys = ["title", "author", "note", "tags", "id", "venue"];
    for (const paper of global.state.sortedPapers) {
        const contents = contentKeys.map((key) => {
            if (Array.isArray(paper[key])) {
                return paper[key].join(" ").toLowerCase();
            } else if (typeof paper[key] === "string") {
                return paper[key].toLowerCase();
            }
            logError(`searchMemory: non-string & non-array content for key ${key}`);
            log(paper);
            return "";
        });

        if (words.every((w) => contents.some((c) => c.includes(w)))) {
            if (!global.state.showFavorites || paper.favorite) {
                papersList.push(paper);
            }
        }
    }
    global.state.papersList = papersList;
};

/**
 * Filters the sortedPapers into papersList, keeping papers published in a list of years
 * e.g.: "y:21, 22" or "y: <2012"
 * @param {string} letters The string representing the tags query, deleting "t:" and splitting on " "
 */
const searchMemoryByYear = (letters) => {
    const condition = letters.includes("<")
        ? "smaller"
        : letters.includes(">")
        ? "greater"
        : "";
    const searchYears = letters
        .replace("y:", "")
        .replace(/(<|>)/g, "")
        .toLowerCase()
        .replaceAll(",", " ")
        .split(" ")
        .filter((y) => y.length > 0)
        .map((y) => (y.length === 4 ? y : "20" + y))
        .map((y) => parseInt(y, 10));
    console.log("searchYears: ", searchYears);
    let papersList = [];
    let compare = (y, py) => y === py;
    if (condition === "smaller") {
        compare = (y, py) => y > py;
    } else if (condition === "greater") {
        compare = (y, py) => y < py;
    }
    for (const paper of global.state.sortedPapers) {
        const paperYear = parseInt(paper.year, 10);
        if (searchYears.some((year) => compare(year, paperYear))) {
            papersList.push(paper);
        }
    }
    global.state.papersList = papersList;
};
/**
 * Filters the sortedPapers into papersList, keeping papers whose tags match the query: all
 * papers whose tags contain all words in the query. Triggered when a query starts with "t: ".
 * e.g.: "cli ga" will look for all papers which have at least 1 tag containing the substring "cli"
 *        AND at least 1 tag containing the substring "ga"
 * @param {string} letters The string representing the tags query, deleting "t:" and splitting on " "
 */
const searchMemoryByTags = (letters) => {
    const tags = letters.replace("t:", "").toLowerCase().split(" ");
    let papersList = [];
    for (const paper of global.state.sortedPapers) {
        const paperTags = paper.tags.map((t) => t.toLowerCase());
        if (tags.every((t) => paperTags.some((pt) => pt.indexOf(t) >= 0))) {
            if (!global.state.showFavorites || paper.favorite) {
                papersList.push(paper);
            }
        }
    }
    global.state.papersList = papersList;
};

/**
 * Filters the sortedPapers into papersList, keeping papers whose code matches the query. Similar
 * to searchMemory but looks into the codeLink attribute. Triggered when a query starts with "c: ".
 * @param {string} letters The string representing the code query, deleting "c:" and splitting on " "
 */
const searchMemoryByCode = (letters) => {
    const words = letters.replace("c:", "").toLowerCase().split(" ");
    let papersList = [];
    for (const paper of global.state.sortedPapers) {
        let paperCode = paper.codeLink || "";
        paperCode = paperCode.toLowerCase();
        if (words.every((w) => paperCode.includes(w))) {
            if (!global.state.showFavorites || paper.favorite) {
                papersList.push(paper);
            }
        }
    }
    global.state.papersList = papersList;
};

/**
 * Updates a paper's tag HTML list from the object's tags array.
 * @param {string} id The paper's id
 */
const updatePaperTagsHTML = (id) => {
    setHTML(
        findEl({ paperId: id, memoryItemClass: "tag-list" }),
        global.state.papers[id].tags
            .map((t) => `<span class="memory-tag">${t}</span>`)
            .join("")
    );
};

/**
 * Update the select2 input for tags, with options from the paper's tags array attribute,
 * using getTagsOptions.
 * @param {string} id The paper's id
 */
const updateTagOptions = (id) => {
    updateAllMemoryPaperTagOptions();
    // update popup tags if the current paper is being edited in the memory
    const tagOptions = getTagsOptions(global.state.papers[id]);
    setHTML(`popup-item-tags--${id}`, tagOptions);
};

/**
 * Update a paper's tags array attribute from the user's selection in a select2 multi-select input.
 * @param {string} id The paper's id
 * @param {string} elementId The paper's html element selector (either an id for the popup main tags, or a class for a memory item)
 */
const updatePaperTags = (id, elementId) => {
    let ref;
    // elementId may be an ID selector (in the main popup)
    // or a class selector (in the memory)
    if (elementId.startsWith("#")) {
        ref = findEl({ element: elementId.replace("#", "") });
    } else {
        ref = findEl({ paperId: id, memoryItemClass: elementId });
    }
    const tags = parseTags(ref);
    let updated = false;
    let newTags = new Set();
    if (!arraysIdentical(global.state.papers[id].tags, tags)) updated = true;
    global.state.papers[id].tags = tags;

    // If there's a change: update the global set of tags:
    // we need to add or remove tags to the global suggestions array
    // for select2
    if (updated) {
        chrome.storage.local.set({ papers: global.state.papers }, () => {
            // update the global set of tags
            makeTags();
            // update the selected tags in the select2 input for this paper
            updateTagOptions(id);
            // update the displayed tags for this paper
            updatePaperTagsHTML(id);
            const tagEls = queryAll(
                ".memory-tag",
                findEl({ paperId: id, memoryItemClass: "tag-list" })
            );
            for (const el of tagEls) {
                addListener(el, "click", handleTagClick);
            }
        });
    }
};

const displayOnScroll = (isPopup) =>
    delay(() => {
        // For fullMemory page, use papers-table-body; for popup, use memory-table
        const isFullMemoryPage = document.getElementById("papers-table-body") !== null;
        const tableElement = isFullMemoryPage 
            ? document.getElementById("papers-table-body")
            : findEl({ element: "memory-table" });
        
        if (!tableElement) return;
        
        const { bottom } = tableElement.getBoundingClientRect();
        const height = isPopup
            ? findEl({ element: "memory-container" }).getBoundingClientRect().height
            : window.innerHeight;
        const currentPapers =
            global.state.currentMemoryPagination * global.state.memoryItemsPerPage;
        if (
            Math.abs(bottom - height) < height &&
            currentPapers < global.state.papersList.length
        ) {
            global.state.currentMemoryPagination += 1;
            
            // Use table view for fullMemory page, card view for popup
            const isFullMemoryPage = document.getElementById("papers-table-body") !== null;
            if (isFullMemoryPage) {
                displayMemoryTableView(global.state.currentMemoryPagination);
            } else {
                displayMemoryTable(global.state.currentMemoryPagination);
            }
        }
    }, 50);

/**
 * Iterates over all papers in the papersList (sorted and filtered),
 * creates each paper's HTML template and appends it to #memory-table.
 * Also creates the relevant events.
 */
const displayMemoryTable = (pagination = 0) => {
    const start = Date.now();

    // Clear existing items
    var memoryTable = findEl({ element: "memory-table" });
    if (pagination === 0) {
        setHTML(memoryTable, "");
        global.state.currentMemoryPagination = 0;
    }

    // Add relevant sorted papers (papersList may be smaller than sortedPapers
    // depending on the search query)
    let table = [];
    for (const paper of global.state.papersList.slice(
        pagination * global.state.memoryItemsPerPage,
        (pagination + 1) * global.state.memoryItemsPerPage
    )) {
        try {
            table.push(getMemoryItemHTML(paper));
        } catch (error) {
            log("displayMemoryTable error:");
            log(error);
            log(paper);
        }
    }
    // https://stackoverflow.com/questions/18393981/append-vs-html-vs-innerhtml-performance
    if (pagination === 0) {
        setHTML(memoryTable, table.join(""));
    } else {
        memoryTable.insertAdjacentHTML("beforeend", table.join(""));
    }

    // Add events
    // after a click on such a button, the focus returns to the
    // container to navigate with tab
    addEventToClass(".back-to-focus", "click", handleBackToFocus);
    // delete memory item
    addEventToClass(".memory-delete", "click", handleDeleteItem);
    // Open paper page
    addEventToClass(".memory-item-link", "click", handleOpenItemLink);
    // Open on Scirate
    addEventToClass(".memory-item-scirate", "click", handleOpenItemScirate);
    // Open on Alphaxiv
    addEventToClass(".memory-item-alphaxiv", "click", handleOpenItemAlphaxiv);
    // Open on Ar5iv
    addEventToClass(".memory-item-ar5iv", "click", handleOpenItemAr5iv);
    // Open on Huggingface Papers
    addEventToClass(".memory-item-huggingface", "click", handleOpenItemHuggingface);
    // Open code page
    addEventToClass(".memory-code-link", "click", handleOpenItemCodeLink);
    // Open Website URL
    addEventToClass(".memory-website-url", "click", handleOpenItemWebsiteURL);
    // Copy markdown link
    addEventToClass(".memory-item-md", "click", handleCopyMarkdownLink);
    // Copy bibtex citation
    addEventToClass(".memory-item-bibtex", "click", handleCopyBibtex);
    // Copy pdf link
    addEventToClass(".memory-item-copy-link", "click", handleCopyPDFLink);
    // Copy hyperlink
    addEventToClass(".memory-item-copy-hyperlink", "click", handleCopyHyperLink);
    // Open local file
    addEventToClass(".memory-item-openLocal", "click", handleMemoryOpenLocal);
    // Add to favorites
    addEventToClass(".memory-item-favorite", "click", handleAddItemToFavorites);
    // Cancel edits: bring previous values from global.state back
    addEventToClass(".cancel-note-form", "click", handleCancelPaperEdit);
    // When clicking on the edit button, either open or close the edit form
    addEventToClass(".memory-item-edit", "click", handleTogglePaperEdit);
    // When clicking on a tag, search for it
    addEventToClass(".memory-tag", "click", handleTagClick);
    // Monitor form changes
    setFormChangeListener(undefined, false);
    // show / remove title tooltips
    addEventToClass(
        ".memory-display-id",
        "click",
        getHandleTitleTooltip(showTitleTooltip, 0)
    );
    addEventToClass(
        ".memory-display-id",
        "mouseleave",
        getHandleTitleTooltip(hideTitleTooltip, 10000)
    );
    // expand authorlist on click
    addEventToClass(".expand-paper-authors", "click", handleExpandAuthors);

    // Put cursor at the end of the textarea's text on focus
    // (default puts the cursor at the beginning of the text)
    addEventToClass(".form-note-textarea", "focus", handleTextareaFocus);
    // Save fields on edits save (submit)
    const end = Date.now();

    info("Display duration (s): " + (end - start) / 1e3);
};

/**
 * Display papers in a table format for the fullMemory page
 * @param {number} pagination - pagination offset
 */
const displayMemoryTableView = (pagination = 0) => {
    const start = Date.now();
    
    // Check if we're in fullMemory page (has papers-table-body element)
    const tableBody = document.getElementById("papers-table-body");
    if (!tableBody) {
        // Fall back to original display for popup
        return displayMemoryTable(pagination);
    }

    // Clear existing rows
    if (pagination === 0) {
        tableBody.innerHTML = "";
        global.state.currentMemoryPagination = 0;
    }

    // Check if there are no papers to display
    if (global.state.papersList.length === 0) {
        if (pagination === 0) {
            showTableEmptyState();
        }
        return;
    }

    // Add relevant sorted papers
    let rows = [];
    const papersToShow = global.state.papersList.slice(
        pagination * global.state.memoryItemsPerPage,
        (pagination + 1) * global.state.memoryItemsPerPage
    );

    for (const paper of papersToShow) {
        try {
            rows.push(getMemoryTableRowHTML(paper));
        } catch (error) {
            log("displayMemoryTableView error:");
            log(error);
            log(paper);
        }
    }

    // Insert rows
    if (pagination === 0) {
        tableBody.innerHTML = rows.join("");
    } else {
        tableBody.insertAdjacentHTML("beforeend", rows.join(""));
    }

    // Add event listeners for table interactions
    addTableEventListeners();

    const end = Date.now();
    info("Table display duration (s): " + (end - start) / 1e3);
};

/**
 * Add event listeners for table interactions
 */
const addTableEventListeners = () => {
    // Favorite star toggle
    addEventToClass(".favorite-star", "click", handleToggleFavoriteTable);
    
    // Paper title click (open paper)
    addEventToClass(".paper-title", "click", handleOpenPaperTable);
    
    // Tag click (search by tag)
    addEventToClass(".tag-badge", "click", handleTagClickTable);
    
    // Copy buttons
    addEventToClass(".copy-md", "click", handleCopyMarkdownTable);
    addEventToClass(".copy-bibtex", "click", handleCopyBibtexTable);
    addEventToClass(".open-paper", "click", handleOpenPaperTable);
    
    // Inline editing
    addEventToClass(".editable-tags", "blur", handleTagsEditTable);
    addEventToClass(".editable-tags", "keydown", handleTagsKeydownTable);
    addEventToClass(".editable-note", "blur", handleNoteEditTable);
    addEventToClass(".editable-note", "keydown", handleNoteKeydownTable);
};

/**
 * Handle favorite star toggle in table
 */
const handleToggleFavoriteTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    if (!paperId || !global.state.papers[paperId]) return;
    
    const paper = global.state.papers[paperId];
    paper.favorite = !paper.favorite;
    
    // Update UI
    event.target.classList.toggle("active", paper.favorite);
    
    // Save to storage
    await setStorage("papers", global.state.papers);
    await pushToRemote();
};

/**
 * Handle paper title/open button click in table
 */
const handleOpenPaperTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    if (!paperId || !global.state.papers[paperId]) return;
    
    const paper = global.state.papers[paperId];
    const url = global.state.prefs.checkPreferPdf ? paperToPDF(paper) : paperToAbs(paper);
    
    // Update visit count and last open date
    paper.count = (paper.count || 0) + 1;
    paper.lastOpenDate = new Date().toISOString();
    
    await setStorage("papers", global.state.papers);
    await pushToRemote();
    
    // Open in new tab
    window.open(url, '_blank');
};

/**
 * Handle tag click in table (search by tag)
 */
const handleTagClickTable = (event) => {
    const tag = event.target.dataset.tag;
    if (!tag) return;
    
    const searchInput = document.getElementById("memory-search");
    if (searchInput) {
        searchInput.value = `t:${tag}`;
        searchInput.dispatchEvent(new Event('keypress'));
    }
};

/**
 * Handle copy markdown in table
 */
const handleCopyMarkdownTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    if (!paperId || !global.state.papers[paperId]) return;
    
    const paper = global.state.papers[paperId];
    const mdLink = makeMdLink(paper, global.state.prefs);
    
    try {
        await navigator.clipboard.writeText(mdLink);
        showTableFeedback(event.target, "Markdown copied!");
    } catch (err) {
        console.error("Failed to copy:", err);
    }
};

/**
 * Handle copy bibtex in table
 */
const handleCopyBibtexTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    if (!paperId || !global.state.papers[paperId]) return;
    
    const paper = global.state.papers[paperId];
    let bibtex = paper.bibtex;
    
    // Ensure URL and PDF fields are present
    const bibtexObj = bibtexToObject(bibtex);
    if (!bibtexObj.hasOwnProperty("url")) {
        bibtexObj.url = paperToAbs(paper);
    }
    if (!bibtexObj.hasOwnProperty("pdf")) {
        bibtexObj.pdf = paperToPDF(paper);
    }
    bibtex = bibtexToString(bibtexObj);
    
    try {
        await navigator.clipboard.writeText(bibtex);
        showTableFeedback(event.target, "BibTeX copied!");
    } catch (err) {
        console.error("Failed to copy:", err);
    }
};

/**
 * Handle tags editing in table
 */
const handleTagsEditTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    const newValue = event.target.value.trim();
    const originalValue = event.target.dataset.originalValue;
    
    if (!paperId || newValue === originalValue) return;
    
    const paper = global.state.papers[paperId];
    if (!paper) return;
    
    // Parse tags from comma-separated string
    const newTags = newValue ? newValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    paper.tags = newTags;
    
    // Update original value
    event.target.dataset.originalValue = newValue;
    
    // Save to storage
    await setStorage("papers", global.state.papers);
    await pushToRemote();
    
    showTableFeedback(event.target, "Tags updated!");
};

/**
 * Handle tags keydown (save on Enter, cancel on Escape)
 */
const handleTagsKeydownTable = (event) => {
    if (event.key === 'Enter') {
        event.target.blur();
    } else if (event.key === 'Escape') {
        event.target.value = event.target.dataset.originalValue;
        event.target.blur();
    }
};

/**
 * Handle note editing in table
 */
const handleNoteEditTable = async (event) => {
    const paperId = event.target.dataset.paperId;
    const newValue = event.target.value.trim();
    const originalValue = event.target.dataset.originalValue;
    
    if (!paperId || newValue === originalValue) return;
    
    const paper = global.state.papers[paperId];
    if (!paper) return;
    
    paper.note = newValue;
    
    // Update original value
    event.target.dataset.originalValue = newValue;
    
    // Save to storage
    await setStorage("papers", global.state.papers);
    await pushToRemote();
    
    showTableFeedback(event.target, "Note updated!");
};

/**
 * Handle note keydown (save on Ctrl+Enter, cancel on Escape)
 */
const handleNoteKeydownTable = (event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
        event.target.blur();
    } else if (event.key === 'Escape') {
        event.target.value = event.target.dataset.originalValue;
        event.target.blur();
    }
};

/**
 * Show temporary feedback message near an element
 */
const showTableFeedback = (element, message) => {
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: absolute;
        background: var(--success-color, #28a745);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 1000;
        pointer-events: none;
    `;
    
    const rect = element.getBoundingClientRect();
    feedback.style.left = rect.left + 'px';
    feedback.style.top = (rect.top - 30) + 'px';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        document.body.removeChild(feedback);
    }, 2000);
};

/**
 * Show empty state for the table when no papers are found
 */
const showTableEmptyState = () => {
    const tableBody = document.getElementById("papers-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-empty">
                <h3>No papers found</h3>
                <p>Try adjusting your search terms or filters.</p>
            </td>
        </tr>
    `;
};

/**
 * Show loading state for the table
 */
const showTableLoadingState = () => {
    const tableBody = document.getElementById("papers-table-body");
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-loading">
                <div class="pm-loader" style="width: 32px; height: 32px; margin: 0 auto 16px;"></div>
                Loading papers...
            </td>
        </tr>
    `;
};

/**
 * Main function called after the user clicks on the PaperMemory button
 * or presses `a`.
 * + closes the menu if it is open (should not be)
 */
const makeMemoryHTML = async () => {
    // Fill-in input placeholder
    setPlaceholder(
        "memory-search",
        `Search ${global.state.papersList.length} entries ...`
    );

    // Use table view for fullMemory page, card view for popup
    const isFullMemoryPage = document.getElementById("papers-table-body") !== null;
    if (isFullMemoryPage) {
        displayMemoryTableView();
    } else {
        displayMemoryTable();
    }

    // add input search delay if there are many papers:
    // wait for some time between keystrokes before firing the search
    let delayTime = 300;
    if (global.state.papersList.length < 20) {
        delayTime = 0;
    } else if (global.state.papersList.length < 100) {
        delayTime = 150;
    }

    // search keypress events.
    // deprecated fix: https://stackoverflow.com/questions/49278648/alternative-for-events-deprecated-keyboardevent-which-property
    addListener(
        "memory-search",
        "keypress",
        delay(handleMemorySearchKeyPress(), delayTime)
    );
    addListener("memory-search", "clear-search", handleMemorySearchKeyPress(true));
    addListener("memory-search", "keyup", handleMemorySearchKeyUp);
    addListener("delete-paper-modal-cancel-button", "click", handleCancelModalClick);
    addListener(
        "delete-paper-modal-confirm-button",
        "click",
        handleConfirmDeleteModalClick
    );
    addListener("filter-favorites", "click", handleFilterFavorites);
    // listen to sorting feature change
    addListener("memory-select", "change", handleMemorySelectChange);
    // listen to sorting direction change
    addListener("memory-sort-arrow", "click", handleMemorySortArrow);
    addListener("memory-container", "scroll", displayOnScroll(true));
};

const openMemory = () => {
    global.state.prefsIsOpen && closeMenu();
    global.state.memoryIsOpen = true;
    // hide menu button
    hideId("memory-switch-open");
    showId("memory-switch-close");
    hideId("menu-switch");
    dispatch("memory-switch", "blur");
    slideDown("memory-container", 200, () => {
        setTimeout(() => {
            dispatch("memory-search", "focus");
        }, 100);
    });
    setTimeout(() => {
        addListener("memory-search-clear-icon", "click", handleClearSearch);
        // set default sort to lastOpenDate
        val("memory-select", "lastOpenDate");
        // set default sort direction arrow down
        setMemorySortArrow("down");
    }, 200);
};

/**
 * Closes the memory overlay with slideUp
 */
const closeMemory = () => {
    dispatch("memory-switch", "blur");
    hideId("memory-switch-close");
    showId("memory-switch-open");
    slideUp("memory-container", 200, () => {
        val("memory-search", "");
        dispatch("memory-search", "clear-search");
        global.state.memoryIsOpen = false;
        if (global.state.showFavorites) {
            dispatch("filter-favorites", "click");
        }
        showId("menu-switch", "flex");
    });
};
