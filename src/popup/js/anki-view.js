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
        
        <div class="anki-card-form">
            <div class="anki-field-group">
                <label for="anki-question">Question/Front</label>
                <div class="anki-question-container">
                    <div class="anki-capture-area" id="anki-capture-area">
                        <div class="anki-capture-placeholder" id="anki-capture-placeholder">
                            <p>Add a screenshot to your Anki card</p>
                            <button type="button" id="anki-capture-btn">Capture Screen</button>
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
    
    // Add card button
    const addCardBtn = document.getElementById('anki-add-card-btn');
    if (addCardBtn) {
        addCardBtn.addEventListener('click', handleAddToAnki);
    }
    
    // ESC key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && ankiViewState.isOpen) {
            closeAnkiView();
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
        // Capture the visible tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }
            
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
                <button class="anki-crop-btn anki-crop-confirm" id="anki-use-selection-enhanced">Use Selection</button>
                <button class="anki-crop-btn anki-crop-full" id="anki-use-full-enhanced">Use Full Image</button>
                <button class="anki-crop-btn anki-crop-cancel" id="anki-crop-cancel-enhanced">Cancel</button>
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
    
    // Use the full available area - up to 1200px wide, 600px tall
    const maxWidth = 1200;
    const maxHeight = 600;
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
    
    // Store the scale factor for coordinate mapping
    cropCanvas.dataset.scaleX = (originalCanvas.width / displayWidth).toString();
    cropCanvas.dataset.scaleY = (originalCanvas.height / displayHeight).toString();
    
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
    
    // Button handlers - using setTimeout to ensure elements exist
    setTimeout(() => {
        const useSelectionBtn = document.getElementById('anki-use-selection-enhanced');
        const useFullBtn = document.getElementById('anki-use-full-enhanced');
        const cancelBtn = document.getElementById('anki-crop-cancel-enhanced');
        
        if (useSelectionBtn) {
            useSelectionBtn.addEventListener('click', () => {
                if (selection && selection.width > 10 && selection.height > 10) {
                    console.log('Using selection for enhanced crop:', selection);
                    cropAndSaveImageEnhanced(originalCanvas, displayCanvas, selection);
                } else {
                    showAnkiStatus('Please select an area first', 'error');
                }
            });
        }
        
        if (useFullBtn) {
            useFullBtn.addEventListener('click', () => {
                cropAndSaveImageEnhanced(originalCanvas, displayCanvas, null);
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
        
        // Add card to Anki
        await addAnkiCard('arxiv', frontContent, answer, tagList);
        
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
