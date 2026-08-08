/**
 * ==========================================================================
 * DERREDGUARDIAN INDUSTRIES® - TERMINAL MESSAGING SYSTEM
 * Modular aufgebautes JavaScript-Modul mit LocalStorage Speicherung
 * ==========================================================================
 */

// Selbstausführendes Modul zum Schutz des globalen Scopes
const CyberTerminal = (() => {
    
    // Private Variablen & Selektoren
    const STORAGE_KEY = 'DerRedGuardian_Messages_V1';
    const messageForm = document.getElementById('message-form');
    const authorInput = document.getElementById('author-input');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const clearFeedBtn = document.getElementById('clear-feed-btn');

    /**
     * Nachrichten aus dem LocalStorage abrufen
     * @returns {Array} Array mit Nachrichten-Objekten
     */
    const getMessages = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    };

    /**
     * Nachrichten im LocalStorage speichern
     * @param {Array} messages - Das zu speichernde Array
     */
    const saveMessages = (messages) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    };

    /**
     * Formatiert das aktuelle Datum in einen Cyberpunk-Timestamp
     * @returns {string} Formatiertes Datum
     */
    const getCyberTimestamp = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
        return `[${dateStr} // ${timeStr}]`;
    };

    /**
     * Nachrichten im HTML Rendern
     */
    const renderMessages = () => {
        const messages = getMessages();
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="empty-message">
                    Keine Einträge im Terminal gefunden. Verfasse die erste Nachricht...
                </div>
            `;
            return;
        }

        // Neue Nachrichten oben anzeigen
        messages.slice().reverse().forEach((msg) => {
            const msgElement = document.createElement('article');
            msgElement.className = 'message-item';
            
            msgElement.innerHTML = `
                <div class="message-header">
                    <span class="message-author">👤 ${escapeHTML(msg.author)}</span>
                    <span class="message-time">${msg.timestamp}</span>
                </div>
                <div class="message-body">${escapeHTML(msg.text)}</div>
            `;
            
            messagesContainer.appendChild(msgElement);
        });
    };

    /**
     * HTML Escaping gegen XSS Angriffsschwachstellen
     */
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    /**
     * Neue Nachricht hinzufügen
     */
    const handleAddMessage = (e) => {
        e.preventDefault();

        const author = authorInput.value.trim();
        const text = messageInput.value.trim();

        if (!author || !text) return;

        const newMessage = {
            id: Date.now(),
            author: author,
            text: text,
            timestamp: getCyberTimestamp()
        };

        const currentMessages = getMessages();
        currentMessages.push(newMessage);
        saveMessages(currentMessages);

        // Formular zurücksetzen
        messageInput.value = '';
        
        // Feed aktualisieren
        renderMessages();
    };

    /**
     * Feed zurücksetzen
     */
    const handleClearFeed = () => {
        if (confirm('Achtung Master Guardian: Soll der komplette Terminal Feed gelöscht werden?')) {
            localStorage.removeItem(STORAGE_KEY);
            renderMessages();
        }
    };

    /**
     * Event Listener initialisieren
     */
    const initEvents = () => {
        if (messageForm) {
            messageForm.addEventListener('submit', handleAddMessage);
        }
        if (clearFeedBtn) {
            clearFeedBtn.addEventListener('click', handleClearFeed);
        }
    };

    /**
     * Öffentliche Initialisierungsmethode
     */
    const init = () => {
        initEvents();
        renderMessages();
        console.log('DerRedGuardian Industries® Terminal System gestartet.');
    };

    return {
        init: init
    };

})();

// Anwendung ausführen, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', CyberTerminal.init);
