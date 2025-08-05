var REFRESH_INTERVAL_SECS = 5 * 60;
// var REFRESH_INTERVAL_SECS = 20;

const adjustCss = () => {
    // CSS is now handled entirely by the stylesheet with responsive design
    // No need for dynamic width adjustments
};

const autoRefresh = () => {
    if (window.location.href.includes("?noRefresh=true")) {
        warn("No auto refresh");
        return;
    }
    info(`Enabling auto refresh if inactive for ${REFRESH_INTERVAL_SECS} seconds.`);
    const reload = () => {
        window.location.reload();
    };

    let time;

    const resetTimer = () => {
        clearTimeout(time);
        time = setTimeout(reload, REFRESH_INTERVAL_SECS * 1000);
    };
    const events = ["click", "keypress", "touchstart"];
    events.forEach(function (name) {
        document.addEventListener(name, resetTimer, true);
    });
    resetTimer();
};

const syncOnBlur = async () => {
    if (!(await shouldSync())) return;
    window.addEventListener(
        "blur",
        delay(async () => {
            info("Syncing back and forth...");
            await pushToRemote();
            await initSyncAndState();
        }, 10e3)
    );
};

(async () => {
    await initSyncAndState();
    makeMemoryHTML();
    
    // Add event listeners for the new integrated controls
    addListener("memory-search-clear", "click", handleClearSearch);
    addListener("filter-favorites", "click", handleFilterFavorites);
    addListener("memory-select", "change", handleMemorySelectChange);
    addListener("memory-sort-toggle", "click", handleMemorySortArrow);
    
    // For fullMemory page, listen to window scroll since the page itself scrolls
    addListener(window, "scroll", displayOnScroll(false));
    
    // Set default sort to lastOpenDate
    val("memory-select", "lastOpenDate");
    // Set default sort direction arrow down  
    setMemorySortArrow("down");
    
    adjustCss();
    autoRefresh();
    syncOnBlur();
})();
