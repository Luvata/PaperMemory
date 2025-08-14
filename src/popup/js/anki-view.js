/**
 * Anki View Component - Side Panel Implementation
 * Provides interface for creating Anki cards from papers
 */

let ankiViewState = {
    isOpen: false,
    currentPaper: null,
    capturedImage: null
};

// Hotkey support - Listen for Ctrl+K (or Cmd+K on Mac)
document.addEventListener('keydown', function(e) {
    // Check for Ctrl+K (Windows/Linux) or Cmd+K (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleAnkiView();
    }
});

/**
 * Toggle Anki view on/off
 */
function toggleAnkiView() {
    console.log('Toggle Anki view called, current state:', ankiViewState.isOpen);
    
    if (ankiViewState.isOpen) {
        closeAnkiView();
    } else {
        // Try to get current paper
        const currentPaper = getCurrentPaper();
        if (currentPaper) {
            openAnkiView(currentPaper);
        } else {
            showAnkiStatus('No paper found. Please open a paper first.', 'error');
        }
    }
}

/**
 * Open the Anki side panel
 * @param {object} paper - Paper object
 */
async function openAnkiView(paper) {
    console.log('Opening Anki view for paper:', paper);
    
    try {
        // Check if AnkiConnect is available
        const isAvailable = await isAnkiConnectAvailable();
        if (!isAvailable) {
            showAnkiStatus('AnkiConnect is not available. Please make sure Anki is running with AnkiConnect installed.', 'error');
            return;
        }

        ankiViewState.currentPaper = paper;
        ankiViewState.isOpen = true;
        
        // Expand the popup for Anki functionality
        document.documentElement.classList.add('anki-active');
        document.body.classList.add('anki-active');
        
        const sidePanel = document.getElementById('anki-side-panel');
        const popupContainer = document.getElementById('popup-container');
        const sideContent = document.getElementById('anki-side-content');
        
        if (!sidePanel || !sideContent) {
            console.error('Anki side panel elements not found');
            return;
        }
        
        // Create the form content
        sideContent.innerHTML = createAnkiFormContent(paper);
        
        // Show side panel
        sidePanel.style.display = 'block';
        setTimeout(() => {
            sidePanel.classList.add('open');
            popupContainer.classList.add('anki-open');
        }, 10);
        
        // Setup event listeners
        setupAnkiEventListeners();
        
        // Load existing cards for this paper
        loadExistingCards(paper);
        
        // Focus on question field
        setTimeout(() => {
            const questionField = document.getElementById('anki-question');
            if (questionField) questionField.focus();
        }, 300);
        
        console.log('Anki view opened successfully');
        
    } catch (error) {
        console.error('Failed to open Anki view:', error);
        showAnkiStatus('Failed to open Anki view: ' + error.message, 'error');
    }
}

/**
 * Close the Anki side panel
 */
function closeAnkiView() {
    console.log('Closing Anki view');
    
    ankiViewState.isOpen = false;
    ankiViewState.currentPaper = null;
    ankiViewState.capturedImage = null;
    
    // Restore popup to normal size
    document.documentElement.classList.remove('anki-active');
    document.body.classList.remove('anki-active');
    
    const sidePanel = document.getElementById('anki-side-panel');
    const popupContainer = document.getElementById('popup-container');
    
    if (sidePanel) {
        sidePanel.classList.remove('open');
        popupContainer.classList.remove('anki-open');
        
        // Hide after animation
        setTimeout(() => {
            sidePanel.style.display = 'none';
        }, 300);
    }
}

/**
 * Create the form content for the side panel
 * @param {object} paper - Paper object
 * @returns {string} HTML content
 */
function createAnkiFormContent(paper) {
    const shortMetadata = createShortPaperMetadata(paper);
    
    return `
        <div class="anki-paper-info">
            <h3>${paper.title || 'Unknown Title'}</h3>
            <p><strong>Authors:</strong> ${paper.author || paper.authors || 'Unknown'}</p>
            <div class="anki-short-metadata">${shortMetadata}</div>
        </div>
        
        <!-- Existing Cards Section -->
        <div class="anki-existing-cards" id="anki-existing-cards" style="display: none;">
            <h4>📚 Existing Cards for this Paper</h4>
            <div class="anki-cards-list" id="anki-cards-list">
                <div class="anki-loading">Loading existing cards...</div>
            </div>
        </div>
        
        <div class="anki-card-form">
            <div class="anki-field-group">
                <label for="anki-question">Question/Front</label>
                <div class="anki-question-container">
            <div class="anki-capture-area" id="anki-capture-area">
                <div class="anki-capture-placeholder" id="anki-capture-placeholder">
                    <p>Add a screenshot to your Anki card</p>
                    <button type="button" id="anki-capture-btn" title="Shortcut: Option/Alt + Shift + C">📷 Capture (Option+Shift+C)</button>
                    <button type="button" id="anki-capture-fullscreen-btn" title="Shortcut: Cmd/Ctrl + Shift + S or Option/Alt + Shift + S">🖼️ Fullscreen Capture (Cmd/Ctrl+Shift+S)</button>
                </div>
                <canvas id="anki-capture-canvas" style="display: none;"></canvas>
            </div>
                    <textarea id="anki-question" placeholder="Enter your question here..." rows="3"></textarea>
                </div>
            </div>
            
            <div class="anki-field-group">
                <label for="anki-answer">Answer/Back</label>
                <textarea id="anki-answer" placeholder="Enter your answer here..." rows="4"></textarea>
            </div>
            
            <div class="anki-field-group">
                <label for="anki-tags">Tags (optional)</label>
                <input type="text" id="anki-tags" placeholder="e.g., machine-learning, computer-vision" />
            </div>
            
            <div class="anki-actions">
                <button type="button" class="anki-secondary-btn" onclick="closeAnkiView()">Cancel</button>
                <button type="button" class="anki-primary-btn" id="anki-add-card-btn">Add to Anki</button>
            </div>
            
            <div id="anki-status" style="display: none;"></div>
        </div>
    `;
}

/**
 * Create short metadata for the front of the card
 * @param {object} paper - Paper object
 * @returns {string} HTML metadata
 */
function createShortPaperMetadata(paper) {
    const parts = [];
    
    // Add short title
    const shortTitle = createShortTitle(paper.title || 'Unknown Title');
    if (shortTitle) {
        parts.push(`<strong>${shortTitle}</strong>`);
    }
    
    if (paper.year) {
        parts.push(paper.year);
    }
    
    if (paper.venue) {
        parts.push(paper.venue);
    }
    
    // Create link based on paper source
    let url = null;
    if (paper.source === 'arxiv' && paper.id) {
        const arxivId = arxivIdFromPaperID(paper.id);
        if (arxivId) {
            url = `https://arxiv.org/abs/${arxivId}`;
        }
    } else if (paper.url) {
        url = paper.url;
    } else if (paper.pdfLink) {
        url = paper.pdfLink;
    }
    
    if (url) {
        parts.push(`<a href="${url}" target="_blank">Link</a>`);
    }
    
    return parts.length > 0 ? `<small>${parts.join(' • ')}</small>` : '';
}

/**
 * Create a short title from the full title
 * @param {string} title - Full paper title
 * @returns {string} Short title
 */
function createShortTitle(title) {
    if (!title) return '';
    
    let textToProcess = title;
    
    // If title contains a colon, take part before colon
    if (title.includes(':')) {
        textToProcess = title.split(':')[0].trim();
    }
    
    // Take first 3 words
    const words = textToProcess.split(/\s+/);
    return words.slice(0, 3).join(' ');
}

/**
 * Setup event listeners for the Anki form
 */
function setupAnkiEventListeners() {
    // Close button
    const closeBtn = document.getElementById('anki-side-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAnkiView);
    }
    
    // Capture screen button
    const captureBtn = document.getElementById('anki-capture-btn');
    if (captureBtn) {
        captureBtn.addEventListener('click', startScreenCapture);
    }
    const captureFullscreenBtn = document.getElementById('anki-capture-fullscreen-btn');
    if (captureFullscreenBtn) {
        captureFullscreenBtn.addEventListener('click', startFullscreenCropOverlay);
    }
    
    // Add card button
    const addCardBtn = document.getElementById('anki-add-card-btn');
    if (addCardBtn) {
        addCardBtn.addEventListener('click', handleAddToAnki);
    }
    
    // Global hotkeys while Anki panel is open
    document.addEventListener('keydown', function(e) {
        if (!ankiViewState.isOpen) return;
        // Close panel
        if (e.key === 'Escape') {
            // If a cropping UI is open, let the cropping handler take precedence
            const cropOpen = document.querySelector('.anki-enhanced-crop-container') || document.querySelector('.anki-crop-container');
            if (!cropOpen) {
                closeAnkiView();
            }
            return;
        }
        // Start capture: Option/Alt + Shift + C
        if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            startScreenCapture();
        }
        // Start fullscreen overlay crop: Cmd/Ctrl + Shift + S or Option/Alt + Shift + S
        if (
            e.shiftKey &&
            (e.metaKey || e.ctrlKey || e.altKey) &&
            ((e.code && e.code === 'KeyS') || (typeof e.key === 'string' && e.key.toLowerCase() === 's'))
        ) {
            e.preventDefault();
            startFullscreenCropOverlay();
        }
    });
}

/**
 * Start screen capture with cropping interface
 */
/**
 * Start screen capture process
 */
async function startScreenCapture() {
    try {
        // Ask background to capture the visible tab (works in MV3)
        chrome.runtime.sendMessage({ type: 'captureTab' }, (response) => {
            if (!response || !response.ok) {
                console.error('Screen capture failed:', response?.error);
                showAnkiStatus('Screen capture failed: ' + (response?.error || 'unknown error'), 'error');
                return;
            }
            const dataUrl = response.dataUrl;
            // Create image for cropping
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                // Show enhanced popup cropping interface instead of full-screen
                showEnhancedCroppingInterface(canvas);
            };
            img.src = dataUrl;
        });
        
    } catch (error) {
        console.error('Screen capture failed:', error);
        showAnkiStatus('Screen capture failed: ' + error.message, 'error');
    }
}

/**
 * Start a fullscreen cropping overlay on the active tab (delegates to content script)
 */
function startFullscreenCropOverlay() {
    try {
        chrome.runtime.sendMessage({ type: 'startFullscreenCrop' });
    } catch (_) {}
}

// Receive crop result from content script fullscreen overlay
chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'anki-crop-result' && message.dataUrl) {
        try {
            // Auto-add to Anki (no UI) — create front = short meta + image, empty back
            const paper = ankiViewState.currentPaper || getCurrentPaper();
            const shortMetadata = createShortPaperMetadata(paper);
            let frontContent = '';
            if (shortMetadata) frontContent += shortMetadata + '<br><br>';
            frontContent += `<img src="${message.dataUrl}"><br>`;
            const tagList = ['arxiv','papermemory'];
            if (paper && paper.source === 'arxiv' && paper.id) tagList.push(`arxiv:${paper.id}`);
            // Ask background to add note via AnkiConnect
            chrome.runtime.sendMessage({ type: 'anki-add-from-crop', dataUrl: message.dataUrl, paper }, (resp) => {
                if (!resp || !resp.ok) {
                    // Fallback to showing in panel if add failed
                    try {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            ankiViewState.capturedImage = jpegDataUrl;
                            showCapturedImageResult(jpegDataUrl, canvas);
                        };
                        img.src = message.dataUrl;
                    } catch (_) {}
                } else {
                    showAnkiStatus('Card added to Anki from fullscreen capture!', 'success');
                    // Optionally close quickly
                    setTimeout(() => { try { closeAnkiView(); } catch (_) {} }, 1200);
                }
            });
        } catch (e) {
            showAnkiStatus('Failed to use fullscreen capture result', 'error');
        }
    }
});

/**
 * Show enhanced cropping interface with larger popup
 * @param {HTMLCanvasElement} originalCanvas - Original canvas with captured image
 */
function showEnhancedCroppingInterface(originalCanvas) {
    // The popup is already large enough (1300px), so we don't need to expand further
    const sidePanel = document.getElementById('anki-side-panel');
    
    const captureArea = document.getElementById('anki-capture-area');
    const placeholder = document.getElementById('anki-capture-placeholder');
    
    // Hide placeholder
    placeholder.style.display = 'none';
    
    // Create enhanced cropping interface
    const cropContainer = document.createElement('div');
    cropContainer.className = 'anki-enhanced-crop-container';
    
    cropContainer.innerHTML = `
        <div class="anki-crop-instructions">
            <h4 style="margin: 0 0 8px 0; color: var(--text);">Crop Screenshot for Anki Card</h4>
            <p style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--text-secondary);">Drag to select the area you want to include in your card</p>
            <div class="anki-crop-buttons">
                <button class="anki-crop-btn anki-crop-confirm" id="anki-use-selection-enhanced" title="Enter">✅ Use Selection (Enter)</button>
                <button class="anki-crop-btn anki-crop-full" id="anki-use-full-enhanced" title="F">🖼️ Full Image (F)</button>
                <button class="anki-crop-btn anki-crop-cancel" id="anki-crop-cancel-enhanced" title="Esc">✖ Cancel (Esc)</button>
            </div>
        </div>
        <div class="anki-enhanced-crop-canvas-container">
            <canvas class="anki-crop-canvas" id="anki-enhanced-crop-canvas"></canvas>
            <div class="anki-crop-overlay" id="anki-enhanced-crop-overlay"></div>
        </div>
    `;
    
    captureArea.appendChild(cropContainer);
    
    // Copy canvas to crop canvas with optimal display size for the expanded popup
    const cropCanvas = document.getElementById('anki-enhanced-crop-canvas');
    const cropCtx = cropCanvas.getContext('2d');
    
    // Fit to available space to avoid scrolling
    const containerRect = captureArea.getBoundingClientRect();
    // Use full popup width to minimize discrepancy and reduce rounding
    const availableWidth = Math.max(900, Math.min(containerRect.width - 32, 1200));
    const availableHeight = Math.max(500, Math.min(window.innerHeight - 180, 900));
    const maxWidth = availableWidth;
    const maxHeight = availableHeight;
    const scale = Math.min(maxWidth / originalCanvas.width, maxHeight / originalCanvas.height, 1);
    
    const displayWidth = originalCanvas.width * scale;
    const displayHeight = originalCanvas.height * scale;
    
    // Set both canvas internal dimensions and CSS display dimensions
    cropCanvas.width = displayWidth;
    cropCanvas.height = displayHeight;
    cropCanvas.style.width = displayWidth + 'px'; 
    cropCanvas.style.height = displayHeight + 'px';
    
    // Draw the image maintaining aspect ratio
    cropCtx.drawImage(originalCanvas, 0, 0, displayWidth, displayHeight);
    
    // Store precise scale factors for coordinate mapping (avoid rounding)
    cropCanvas.dataset.scaleX = String(originalCanvas.width / displayWidth);
    cropCanvas.dataset.scaleY = String(originalCanvas.height / displayHeight);
    
    // Setup enhanced cropping interaction
    setupEnhancedCropping(cropCanvas, originalCanvas, sidePanel, null, null);
}

/**
 * Setup enhanced cropping functionality
 * @param {HTMLCanvasElement} displayCanvas - Display canvas  
 * @param {HTMLCanvasElement} originalCanvas - Original full-size canvas
 * @param {HTMLElement} sidePanel - Side panel element (not needed anymore)
 * @param {string} originalWidth - Not needed anymore
 * @param {string} originalMaxWidth - Not needed anymore
 */
function setupEnhancedCropping(displayCanvas, originalCanvas, sidePanel, originalWidth, originalMaxWidth) {
    const overlay = document.getElementById('anki-enhanced-crop-overlay');
    const canvasContainer = displayCanvas.parentElement;
    
    let isDrawing = false;
    let startX, startY, selection = null;
    
    function getMousePos(e) {
        const rect = displayCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    displayCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        overlay.style.display = 'block';
        
        // Position overlay initially
        overlay.style.left = startX + 'px';
        overlay.style.top = startY + 'px';
        overlay.style.width = '0px';
        overlay.style.height = '0px';
        
        // Prevent text selection during drag
        e.preventDefault();
        
        console.log('Enhanced cropping started at:', { x: startX, y: startY });
    });
    
    displayCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        const pos = getMousePos(e);
        
        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(pos.x, displayCanvas.width));
        const constrainedY = Math.max(0, Math.min(pos.y, displayCanvas.height));
        
        // Calculate selection rectangle
        const left = Math.min(startX, constrainedX);
        const top = Math.min(startY, constrainedY);
        const width = Math.abs(constrainedX - startX);
        const height = Math.abs(constrainedY - startY);
        
        selection = { left, top, width, height };
        
        // Position overlay relative to canvas container, not document
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        overlay.style.width = width + 'px';
        overlay.style.height = height + 'px';
        
        // Prevent text selection during drag
        e.preventDefault();
    });
    
    displayCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
        console.log('Enhanced cropping selection completed:', selection);
    });
    
    // Also handle mouse leave to stop drawing
    displayCanvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            isDrawing = false;
        }
    });
    
    // Button handlers and hotkeys - using setTimeout to ensure elements exist
    setTimeout(() => {
        const useSelectionBtn = document.getElementById('anki-use-selection-enhanced');
        const useFullBtn = document.getElementById('anki-use-full-enhanced');
        const cancelBtn = document.getElementById('anki-crop-cancel-enhanced');
        
        const cleanupHotkeys = () => {
            document.removeEventListener('keydown', keyHandler);
        };
        const keyHandler = (evt) => {
            if (!ankiViewState.isOpen) return;
            if (evt.key === 'Enter') {
                evt.preventDefault();
                if (selection && selection.width > 10 && selection.height > 10) {
                    cropAndSaveImageEnhanced(originalCanvas, displayCanvas, selection);
                    cleanupHotkeys();
                } else {
                    showAnkiStatus('Please select an area first', 'error');
                }
            } else if (evt.key.toLowerCase() === 'f') {
                evt.preventDefault();
                cropAndSaveImageEnhanced(originalCanvas, displayCanvas, null);
                cleanupHotkeys();
            } else if (evt.key === 'Escape') {
                evt.preventDefault();
                const captureArea = document.getElementById('anki-capture-area');
                const placeholder = document.getElementById('anki-capture-placeholder');
                const cropContainer = document.querySelector('.anki-enhanced-crop-container');
                if (cropContainer) cropContainer.remove();
                if (placeholder) placeholder.style.display = 'block';
                cleanupHotkeys();
            }
        };
        document.addEventListener('keydown', keyHandler);
        
        if (useSelectionBtn) {
            useSelectionBtn.addEventListener('click', () => {
                if (selection && selection.width > 10 && selection.height > 10) {
                    console.log('Using selection for enhanced crop:', selection);
                    cropAndSaveImageEnhanced(originalCanvas, displayCanvas, selection);
                    cleanupHotkeys();
                } else {
                    showAnkiStatus('Please select an area first', 'error');
                }
            });
        }
        
        if (useFullBtn) {
            useFullBtn.addEventListener('click', () => {
                cropAndSaveImageEnhanced(originalCanvas, displayCanvas, null);
                cleanupHotkeys();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                // Reset capture area (no need to restore panel size)
                const captureArea = document.getElementById('anki-capture-area');
                const placeholder = document.getElementById('anki-capture-placeholder');
                const cropContainer = document.querySelector('.anki-enhanced-crop-container');
                
                if (cropContainer) cropContainer.remove();
                if (placeholder) placeholder.style.display = 'block';
                cleanupHotkeys();
            });
        }
    }, 100);
}

/**
 * Crop and save image from enhanced interface
 * @param {HTMLCanvasElement} originalCanvas - Original canvas
 * @param {HTMLCanvasElement} displayCanvas - Display canvas
 * @param {object|null} selection - Selection coordinates
 */
function cropAndSaveImageEnhanced(originalCanvas, displayCanvas, selection) {
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    
    if (selection) {
        // Get scale factors from the display canvas data attributes
        const scaleX = parseFloat(displayCanvas.dataset.scaleX) || (originalCanvas.width / displayCanvas.width);
        const scaleY = parseFloat(displayCanvas.dataset.scaleY) || (originalCanvas.height / displayCanvas.height);
        
        // Scale selection to original canvas size
        const cropX = selection.left * scaleX;
        const cropY = selection.top * scaleY;
        const cropWidth = selection.width * scaleX;
        const cropHeight = selection.height * scaleY;
        
        // Ensure crop dimensions are within bounds
        const actualCropX = Math.max(0, Math.min(cropX, originalCanvas.width));
        const actualCropY = Math.max(0, Math.min(cropY, originalCanvas.height));
        const actualCropWidth = Math.min(cropWidth, originalCanvas.width - actualCropX);
        const actualCropHeight = Math.min(cropHeight, originalCanvas.height - actualCropY);
        
        finalCanvas.width = actualCropWidth;
        finalCanvas.height = actualCropHeight;
        
        finalCtx.drawImage(
            originalCanvas,
            actualCropX, actualCropY, actualCropWidth, actualCropHeight,
            0, 0, actualCropWidth, actualCropHeight
        );
        
        console.log('Cropping details:', {
            selection,
            scaleX, scaleY,
            originalCanvas: { width: originalCanvas.width, height: originalCanvas.height },
            displayCanvas: { width: displayCanvas.width, height: displayCanvas.height },
            crop: { x: actualCropX, y: actualCropY, width: actualCropWidth, height: actualCropHeight }
        });
    } else {
        // Use full image
        finalCanvas.width = originalCanvas.width;
        finalCanvas.height = originalCanvas.height;
        finalCtx.drawImage(originalCanvas, 0, 0);
    }
    
    // Convert to JPEG with compression
    const jpegDataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
    
    // Store the captured image
    ankiViewState.capturedImage = jpegDataUrl;
    
    // Clean up cropping interface
    const cropContainer = document.querySelector('.anki-enhanced-crop-container');
    if (cropContainer) {
        cropContainer.remove();
    }
    
    // Show final result in the Anki panel
    showCapturedImageResult(jpegDataUrl, finalCanvas);
}

/**
 * Show captured image result in Anki panel
 * @param {string} jpegDataUrl - Image data URL
 * @param {HTMLCanvasElement} canvas - Canvas with final image
 */
function showCapturedImageResult(jpegDataUrl, canvas) {
    const captureArea = document.getElementById('anki-capture-area');
    const placeholder = document.getElementById('anki-capture-placeholder');
    
    // Hide placeholder
    placeholder.style.display = 'none';
    
    // Remove any existing result
    const existingResult = document.querySelector('.anki-final-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    // Show final result
    const resultContainer = document.createElement('div');
    resultContainer.className = 'anki-final-result';
    
    const fileSizeKB = Math.round((jpegDataUrl.length * 0.75) / 1024);
    
    resultContainer.innerHTML = `
        <img src="${jpegDataUrl}" class="anki-final-capture" alt="Captured image">
        <div class="anki-image-info">
            <small>Captured: ${canvas.width}×${canvas.height}px, ~${fileSizeKB}KB (JPEG)</small>
        </div>
        <button type="button" class="anki-secondary-btn" id="anki-remove-image-btn">Remove Image</button>
    `;
    
    captureArea.appendChild(resultContainer);
    
    // Add event listener for remove button
    document.getElementById('anki-remove-image-btn').addEventListener('click', function() {
        resultContainer.remove();
        placeholder.style.display = 'block';
        ankiViewState.capturedImage = null;
    });
}

/**
 * Show cropping interface (fallback for small screens)
 * @param {HTMLCanvasElement} canvas - Original canvas
 */
function showCroppingInterface(canvas) {
    const captureArea = document.getElementById('anki-capture-area');
    const placeholder = document.getElementById('anki-capture-placeholder');
    
    // Hide placeholder
    placeholder.style.display = 'none';
    
    // Create cropping interface
    const cropContainer = document.createElement('div');
    cropContainer.className = 'anki-crop-container';
    
    cropContainer.innerHTML = `
        <div class="anki-crop-instructions">
            <p>Drag to select the area you want to include in your Anki card</p>
            <div class="anki-crop-buttons">
                <button class="anki-crop-btn anki-crop-confirm" id="anki-use-selection">Use Selection</button>
                <button class="anki-crop-btn anki-crop-full" id="anki-use-full">Use Full Image</button>
                <button class="anki-crop-btn anki-crop-cancel" id="anki-crop-cancel">Cancel</button>
            </div>
        </div>
        <div class="anki-crop-canvas-container">
            <canvas class="anki-crop-canvas" id="anki-crop-canvas"></canvas>
            <div class="anki-crop-overlay" id="anki-crop-overlay"></div>
        </div>
    `;
    
    captureArea.appendChild(cropContainer);
    
    // Copy canvas to crop canvas
    const cropCanvas = document.getElementById('anki-crop-canvas');
    const cropCtx = cropCanvas.getContext('2d');
    
    // Scale down for display if needed
    const maxWidth = 380;
    const maxHeight = 200;
    const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1);
    
    const displayWidth = canvas.width * scale;
    const displayHeight = canvas.height * scale;
    
    // Set both canvas internal dimensions and CSS display dimensions
    cropCanvas.width = displayWidth;
    cropCanvas.height = displayHeight;
    cropCanvas.style.width = displayWidth + 'px'; 
    cropCanvas.style.height = displayHeight + 'px';
    
    // Draw the image maintaining aspect ratio
    cropCtx.drawImage(canvas, 0, 0, displayWidth, displayHeight);
    
    // Store the scale factor for coordinate mapping
    cropCanvas.dataset.scaleX = (canvas.width / displayWidth).toString();
    cropCanvas.dataset.scaleY = (canvas.height / displayHeight).toString();
    
    // Setup cropping interaction
    setupCropping(cropCanvas, canvas);
}

/**
 * Setup cropping functionality
 * @param {HTMLCanvasElement} displayCanvas - Display canvas  
 * @param {HTMLCanvasElement} originalCanvas - Original full-size canvas
 */
function setupCropping(displayCanvas, originalCanvas) {
    const overlay = document.getElementById('anki-crop-overlay');
    
    let isDrawing = false;
    let startX, startY, selection = null;
    
    function getMousePos(e) {
        const rect = displayCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    displayCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;
        overlay.style.display = 'block';
        
        // Position overlay initially
        overlay.style.left = startX + 'px';
        overlay.style.top = startY + 'px';
        overlay.style.width = '0px';
        overlay.style.height = '0px';
        
        // Prevent text selection during drag
        e.preventDefault();
    });
    
    displayCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        const pos = getMousePos(e);
        
        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(pos.x, displayCanvas.width));
        const constrainedY = Math.max(0, Math.min(pos.y, displayCanvas.height));
        
        // Calculate selection rectangle
        const left = Math.min(startX, constrainedX);
        const top = Math.min(startY, constrainedY);
        const width = Math.abs(constrainedX - startX);
        const height = Math.abs(constrainedY - startY);
        
        selection = { left, top, width, height };
        
        // Position overlay relative to canvas container, not document
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        overlay.style.width = width + 'px';
        overlay.style.height = height + 'px';
        
        // Prevent text selection during drag
        e.preventDefault();
    });
    
    displayCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    // Also handle mouse leave to stop drawing
    displayCanvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            isDrawing = false;
        }
    });
    
    // Button handlers - using setTimeout to ensure elements exist
    setTimeout(() => {
        const useSelectionBtn = document.getElementById('anki-use-selection');
        const useFullBtn = document.getElementById('anki-use-full');
        const cancelBtn = document.getElementById('anki-crop-cancel');
        
        if (useSelectionBtn) {
            useSelectionBtn.addEventListener('click', () => {
                if (selection && selection.width > 10 && selection.height > 10) {
                    cropAndSaveImage(originalCanvas, displayCanvas, selection);
                } else {
                    showAnkiStatus('Please select an area first', 'error');
                }
            });
        }
        
        if (useFullBtn) {
            useFullBtn.addEventListener('click', () => {
                cropAndSaveImage(originalCanvas, displayCanvas, null);
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                // Reset capture area
                const captureArea = document.getElementById('anki-capture-area');
                const placeholder = document.getElementById('anki-capture-placeholder');
                const cropContainer = document.querySelector('.anki-crop-container');
                
                if (cropContainer) cropContainer.remove();
                if (placeholder) placeholder.style.display = 'block';
            });
        }
    }, 100);
}

/**
 * Crop and save the selected image
 * @param {HTMLCanvasElement} originalCanvas - Original full-size canvas
 * @param {HTMLCanvasElement} displayCanvas - Display canvas
 * @param {object|null} selection - Selection area or null for full image
 */
function cropAndSaveImage(originalCanvas, displayCanvas, selection) {
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    
    if (selection) {
        // Get scale factors from the display canvas data attributes
        const scaleX = parseFloat(displayCanvas.dataset.scaleX) || (originalCanvas.width / displayCanvas.width);
        const scaleY = parseFloat(displayCanvas.dataset.scaleY) || (originalCanvas.height / displayCanvas.height);
        
        // Scale selection to original canvas size
        const cropX = selection.left * scaleX;
        const cropY = selection.top * scaleY;
        const cropWidth = selection.width * scaleX;
        const cropHeight = selection.height * scaleY;
        
        // Ensure crop dimensions are within bounds
        const actualCropX = Math.max(0, Math.min(cropX, originalCanvas.width));
        const actualCropY = Math.max(0, Math.min(cropY, originalCanvas.height));
        const actualCropWidth = Math.min(cropWidth, originalCanvas.width - actualCropX);
        const actualCropHeight = Math.min(cropHeight, originalCanvas.height - actualCropY);
        
        finalCanvas.width = actualCropWidth;
        finalCanvas.height = actualCropHeight;
        
        finalCtx.drawImage(
            originalCanvas,
            actualCropX, actualCropY, actualCropWidth, actualCropHeight,
            0, 0, actualCropWidth, actualCropHeight
        );
        
        console.log('Cropping details (regular):', {
            selection,
            scaleX, scaleY,
            originalCanvas: { width: originalCanvas.width, height: originalCanvas.height },
            displayCanvas: { width: displayCanvas.width, height: displayCanvas.height },
            crop: { x: actualCropX, y: actualCropY, width: actualCropWidth, height: actualCropHeight }
        });
    } else {
        // Use full image
        finalCanvas.width = originalCanvas.width;
        finalCanvas.height = originalCanvas.height;
        finalCtx.drawImage(originalCanvas, 0, 0);
    }
    
    // Convert to JPEG with compression
    const jpegDataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
    
    // Store the captured image
    ankiViewState.capturedImage = jpegDataUrl;
    
    // Clean up cropping interface
    const cropContainer = document.querySelector('.anki-crop-container');
    if (cropContainer) {
        cropContainer.remove();
    }
    
    // Show final result
    const captureArea = document.getElementById('anki-capture-area');
    const resultContainer = document.createElement('div');
    resultContainer.className = 'anki-final-result';
    
    const fileSizeKB = Math.round((jpegDataUrl.length * 0.75) / 1024);
    
    resultContainer.innerHTML = `
        <img src="${jpegDataUrl}" class="anki-final-capture" alt="Captured image">
        <div class="anki-image-info">
            <small>Captured: ${finalCanvas.width}×${finalCanvas.height}px, ~${fileSizeKB}KB (JPEG)</small>
        </div>
        <button type="button" class="anki-secondary-btn" id="anki-remove-image-btn-popup">Remove Image</button>
    `;
    
    captureArea.appendChild(resultContainer);
    
    // Add event listener for remove button (fixing the onclick issue)
    document.getElementById('anki-remove-image-btn-popup').addEventListener('click', function() {
        resultContainer.remove();
        const placeholder = document.getElementById('anki-capture-placeholder');
        if (placeholder) placeholder.style.display = 'block';
        ankiViewState.capturedImage = null;
    });
    
    console.log(`Image cropped and compressed successfully: ${finalCanvas.width}×${finalCanvas.height}px, ~${fileSizeKB}KB`);
    showAnkiStatus('Image captured and compressed successfully!', 'success');
}

/**
 * Handle adding card to Anki
 */
async function handleAddToAnki() {
    const question = document.getElementById('anki-question').value.trim();
    const answer = document.getElementById('anki-answer').value.trim();
    const tags = document.getElementById('anki-tags').value.trim();
    
    if (!question && !ankiViewState.capturedImage) {
        showAnkiStatus('Please add either a question or capture an image', 'error');
        return;
    }
    
    if (!answer) {
        showAnkiStatus('Please add an answer', 'error');
        return;
    }
    
    try {
        showAnkiStatus('Adding card to Anki...', 'info');
        
        // Prepare front content (with short metadata)
        let frontContent = '';
        
        // Add short metadata first
        const paper = ankiViewState.currentPaper;
        const shortMetadata = createShortPaperMetadata(paper);
        if (shortMetadata) {
            frontContent += shortMetadata + '<br><br>';
        }
        
        // Add image if captured
        if (ankiViewState.capturedImage) {
            frontContent += `<img src="${ankiViewState.capturedImage}"><br><br>`;
        }
        
        // Add question text
        if (question) {
            frontContent += question;
        }
        
        // Prepare tags
        const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
        tagList.push('arxiv', 'papermemory'); // Add default tags
        
        // Add paper metadata to tags for easier searching
        if (paper.source === 'arxiv' && paper.id) {
            tagList.push(`arxiv:${paper.id}`);
        }
        
        // Add card to Anki with paper metadata
        await addAnkiCard('arxiv', frontContent, answer, tagList, paper);
        
        showAnkiStatus('Card added to Anki successfully!', 'success');
        
        // Clear form
        setTimeout(() => {
            closeAnkiView();
        }, 1500);
        
    } catch (error) {
        console.error('Failed to add card to Anki:', error);
        showAnkiStatus('Failed to add card to Anki: ' + error.message, 'error');
    }
}

/**
 * Show status message
 * @param {string} message - Message to show
 * @param {string} type - Type: 'info', 'success', 'error'
 */
function showAnkiStatus(message, type) {
    const statusEl = document.getElementById('anki-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `anki-status-message anki-status-${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

/**
 * Get current paper from the popup state
 * @returns {object|null} Current paper object or null
 */
function getCurrentPaper() {
    // Try to get from popup state or global variables
    if (typeof currentPaper !== 'undefined' && currentPaper) {
        return currentPaper;
    }
    
    if (typeof paper !== 'undefined' && paper) {
        return paper;
    }
    
    // Try to get from popup elements
    const titleEl = document.getElementById('popup-paper-title');
    const authorsEl = document.getElementById('popup-authors');
    
    if (titleEl && titleEl.textContent) {
        return {
            title: titleEl.textContent,
            authors: authorsEl ? authorsEl.textContent.replace('Authors: ', '') : 'Unknown',
            source: 'arxiv', // Assume arxiv for now
            year: new Date().getFullYear() // Fallback
        };
    }
    
    return null;
}

/**
 * Load and display existing cards for the current paper
 * @param {object} paper - Paper object
 */
async function loadExistingCards(paper) {
    const existingCardsSection = document.getElementById('anki-existing-cards');
    const cardsList = document.getElementById('anki-cards-list');
    
    if (!existingCardsSection || !cardsList) return;
    
    try {
        // Create search keys from paper data
        const searchKeys = [];
        
        if (paper.source === 'arxiv' && paper.id) {
            searchKeys.push(paper.id); // arxiv ID like "2401.12345"
            searchKeys.push(`arxiv:${paper.id}`); // with prefix
        }
        
        if (paper.title) {
            // Use first few words of title
            const titleWords = paper.title.split(' ').slice(0, 5).join(' ');
            searchKeys.push(titleWords);
        }
        
        let allCards = [];
        
        // Query for each search key
        for (const key of searchKeys) {
            try {
                const cards = await queryCardsForPaper(key);
                allCards = [...allCards, ...cards];
            } catch (error) {
                console.log(`Failed to query cards for "${key}":`, error);
            }
        }
        
        // Remove duplicates by card ID
        const uniqueCards = allCards.filter((card, index, self) => 
            index === self.findIndex(c => c.cardId === card.cardId)
        );
        
        if (uniqueCards.length > 0) {
            existingCardsSection.style.display = 'block';
            cardsList.innerHTML = renderExistingCards(uniqueCards);
        } else {
            existingCardsSection.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading existing cards:', error);
        existingCardsSection.style.display = 'none';
    }
}

/**
 * Render existing cards HTML
 * @param {Object[]} cards - Array of card objects
 * @returns {string} HTML string
 */
function renderExistingCards(cards) {
    if (cards.length === 0) {
        return '<div class="anki-no-cards">No existing cards found for this paper.</div>';
    }
    
    return cards.map(card => {
        // Extract text content from HTML question/answer
        let questionText = stripHtml(card.question);
        let answerText = stripHtml(card.answer);
        
        // Limit length for preview
        const maxLength = 100;
        const questionPreview = questionText.length > maxLength 
            ? questionText.substring(0, maxLength) + '...' 
            : questionText;
        const answerPreview = answerText.length > maxLength 
            ? answerText.substring(0, maxLength) + '...' 
            : answerText;
        
        // Use the processed text directly (already handles visual content)
        const finalQuestionText = questionPreview || '❓ [No preview available]';
        const finalAnswerText = answerPreview || '💭 [No preview available]';
        
        return `
            <div class="anki-existing-card">
                <div class="anki-card-header">
                    <span class="anki-card-deck">${card.deckName}</span>
                    <span class="anki-card-model">${card.modelName}</span>
                </div>
                <div class="anki-card-content">
                    <div class="anki-card-question">
                        <strong>Q:</strong> ${finalQuestionText}
                    </div>
                    <div class="anki-card-answer">
                        <strong>A:</strong> ${finalAnswerText}
                    </div>
                </div>
                ${card.tags.length > 0 ? `
                    <div class="anki-card-tags">
                        ${card.tags.map(tag => `<span class="anki-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Strip HTML tags and extract meaningful content from text
 * @param {string} html - HTML string
 * @returns {string} Clean plain text
 */
function stripHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Check if there are images
    const images = temp.querySelectorAll('img');
    const hasImages = images.length > 0;
    
    // Get text content
    let text = temp.textContent || temp.innerText || '';
    
    // Remove CSS rules (anything between { and })
    text = text.replace(/\{[^}]*\}/g, '');
    
    // Remove common CSS properties and selectors
    text = text.replace(/\.([\w-]+)\s*\{[^}]*\}/g, ''); // CSS rules
    text = text.replace(/(font-family|font-size|text-align|color|background|margin|padding|border|width|height)[\s:][^;]*;?/gi, '');
    text = text.replace(/rgb\([^)]*\)/gi, ''); // RGB colors
    text = text.replace(/#[0-9a-f]{3,6}/gi, ''); // Hex colors
    text = text.replace(/\d+px/gi, ''); // Pixel values
    
    // Remove extra whitespace and newlines
    text = text.replace(/\s+/g, ' ').trim();
    
    // If we have images and little/no text, describe the visual content
    if (hasImages && text.length < 20) {
        const imageAlts = Array.from(images).map(img => img.alt).filter(alt => alt && alt.length > 0);
        if (imageAlts.length > 0) {
            return `📷 ${imageAlts[0]}`;
        } else {
            return `📷 [Image content]`;
        }
    }
    
    // If the result is still mostly CSS or very short, indicate visual content
    if (text.length < 5 || text.match(/^[\s\w-]*[:{};]/)) {
        if (hasImages) {
            return '📷 [Visual card with image]';
        } else {
            return '🎨 [Formatted content]';
        }
    }
    
    return text;
}
