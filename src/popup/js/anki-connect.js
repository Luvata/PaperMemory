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
 * Add a card to Anki
 * @param {string} deckName - Name of the deck
 * @param {string} front - Front content of the card
 * @param {string} back - Back content of the card
 * @param {string[]} tags - Array of tags
 * @param {object} paper - Paper metadata object (optional)
 * @returns {Promise<number>} Note ID
 */
async function addAnkiCard(deckName, front, back, tags = [], paper = null) {
    // Ensure the deck exists
    if (deckName === 'arxiv') {
        await ensureArxivDeck();
    }

    // Create fields object
    const fields = {
        Front: front,
        Back: back
    };
    
    // Add paper metadata to the back field for searching
    if (paper) {
        let metadata = '<hr><small>';
        if (paper.source === 'arxiv' && paper.id) {
            metadata += `<strong>arXiv:</strong> ${paper.id}<br>`;
        }
        if (paper.title) {
            metadata += `<strong>Title:</strong> ${paper.title}<br>`;
        }
        if (paper.authors || paper.author) {
            metadata += `<strong>Authors:</strong> ${paper.authors || paper.author}<br>`;
        }
        if (paper.year) {
            metadata += `<strong>Year:</strong> ${paper.year}<br>`;
        }
        metadata += '</small>';
        
        fields.Back += metadata;
    }

    const note = {
        deckName: deckName,
        modelName: 'Basic',
        fields: fields,
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

/**
 * Find cards by field content
 * @param {string} query - Anki search query
 * @returns {Promise<number[]>} Array of card IDs
 */
async function findCards(query) {
    return await ankiRequest('findCards', { query: query });
}

/**
 * Get card info by IDs
 * @param {number[]} cardIds - Array of card IDs
 * @returns {Promise<Object[]>} Array of card info objects
 */
async function getCardsInfo(cardIds) {
    return await ankiRequest('cardsInfo', { cards: cardIds });
}

/**
 * Get notes info by note IDs
 * @param {number[]} noteIds - Array of note IDs
 * @returns {Promise<Object[]>} Array of note info objects
 */
async function getNotesInfo(noteIds) {
    return await ankiRequest('notesInfo', { notes: noteIds });
}

/**
 * Query cards for a specific paper by arxiv ID or title
 * @param {string} paperKey - arxiv ID or paper title to search for
 * @returns {Promise<Object[]>} Array of card/note info objects
 */
async function queryCardsForPaper(paperKey) {
    try {
        // Try multiple search patterns
        const queries = [
            `"Source:*${paperKey}*"`,  // Field contains the arxiv ID or title
            `"Paper:*${paperKey}*"`,   // Alternative field name
            `"${paperKey}"`,           // Direct content search
            `note:"*${paperKey}*"`     // Search in any field
        ];
        
        let allCardIds = [];
        
        for (const query of queries) {
            try {
                const cardIds = await findCards(query);
                allCardIds = [...new Set([...allCardIds, ...cardIds])]; // Remove duplicates
            } catch (error) {
                console.log(`Query "${query}" failed:`, error);
            }
        }
        
        if (allCardIds.length === 0) {
            return [];
        }
        
        // Get card info
        const cardsInfo = await getCardsInfo(allCardIds);
        
        // Get note IDs from cards and fetch note info
        const noteIds = [...new Set(cardsInfo.map(card => card.note))];
        const notesInfo = await getNotesInfo(noteIds);
        
        // Combine card and note info
        const results = cardsInfo.map(card => {
            const note = notesInfo.find(n => n.noteId === card.note);
            return {
                cardId: card.cardId,
                noteId: card.note,
                deckName: card.deckName,
                question: card.question,
                answer: card.answer,
                fields: note ? note.fields : {},
                tags: note ? note.tags : [],
                modelName: note ? note.modelName : ''
            };
        });
        
        return results;
        
    } catch (error) {
        console.error('Error querying cards for paper:', error);
        return [];
    }
}
