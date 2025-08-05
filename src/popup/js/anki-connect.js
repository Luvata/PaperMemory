/**
 * AnkiConnect Integration
 * Handles communication with local Anki instance via AnkiConnect plugin
 */

const ANKI_CONNECT_URL = 'http://localhost:8765';

/**
 * Make a request to AnkiConnect
 * @param {string} action - AnkiConnect action name
 * @param {object} params - Parameters for the action
 * @returns {Promise} Response from AnkiConnect
 */
async function ankiRequest(action, params = {}) {
    const request = {
        action: action,
        version: 6,
        params: params
    };

    try {
        const response = await fetch(ANKI_CONNECT_URL, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        return data.result;
    } catch (error) {
        console.error('AnkiConnect request failed:', error);
        throw error;
    }
}

/**
 * Check if AnkiConnect is available
 * @returns {Promise<boolean>} True if AnkiConnect is available
 */
async function isAnkiConnectAvailable() {
    try {
        await ankiRequest('version');
        return true;
    } catch (error) {
        console.error('AnkiConnect not available:', error);
        return false;
    }
}

/**
 * Get AnkiConnect version
 * @returns {Promise<number>} AnkiConnect version
 */
async function getAnkiConnectVersion() {
    return await ankiRequest('version');
}

/**
 * Get list of deck names
 * @returns {Promise<string[]>} Array of deck names
 */
async function getDeckNames() {
    return await ankiRequest('deckNames');
}

/**
 * Create a new deck if it doesn't exist
 * @param {string} deckName - Name of the deck to create
 * @returns {Promise<number>} Deck ID
 */
async function createDeck(deckName) {
    return await ankiRequest('createDeck', { deck: deckName });
}

/**
 * Ensure the arxiv deck exists
 * @returns {Promise<void>}
 */
async function ensureArxivDeck() {
    const deckNames = await getDeckNames();
    if (!deckNames.includes('arxiv')) {
        await createDeck('arxiv');
        console.log('Created arxiv deck');
    }
}

/**
 * Add a note to Anki
 * @param {string} deckName - Deck name
 * @param {string} front - Front of the card
 * @param {string} back - Back of the card
 * @param {string[]} tags - Array of tags
 * @returns {Promise<number>} Note ID
 */
async function addAnkiCard(deckName, front, back, tags = []) {
    // Ensure the deck exists
    if (deckName === 'arxiv') {
        await ensureArxivDeck();
    }

    const note = {
        deckName: deckName,
        modelName: 'Basic',
        fields: {
            Front: front,
            Back: back
        },
        tags: tags,
        options: {
            allowDuplicate: true,
            duplicateScope: 'deck'
        }
    };

    return await ankiRequest('addNote', { note: note });
}

/**
 * Get AnkiConnect status and information
 * @returns {Promise<object>} Status object with version, deck count, etc.
 */
async function getAnkiStatus() {
    try {
        const version = await getAnkiConnectVersion();
        const deckNames = await getDeckNames();
        const hasArxivDeck = deckNames.includes('arxiv');
        
        return {
            available: true,
            version: version,
            deckCount: deckNames.length,
            hasArxivDeck: hasArxivDeck,
            decks: deckNames
        };
    } catch (error) {
        return {
            available: false,
            error: error.message
        };
    }
}
