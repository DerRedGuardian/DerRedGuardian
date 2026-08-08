/**
 * ==========================================================================
 * DERREDGUARDIAN INDUSTRIES® - CORE APP CONTROLLER
 * Modular aufgebautes JavaScript für Tab-Steuerung, Besuchszähler,
 * Admin-Authentifizierung sowie Beitrags- & Bilderverwaltung.
 * ==========================================================================
 */

const DRGApp = (() => {

    // LocalStorage & SessionStorage Schlüssel
    const STORAGE_POSTS = 'DRG_Posts_V2';
    const STORAGE_ADMINS = 'DRG_Admins_V2';
    const STORAGE_VISITS = 'DRG_VisitCounter_V2';
    const SESSION_VISIT_KEY = 'DRG_Visited_Session';

    // Zustandsschlüssel (State)
    let currentAdmin = null;
    let currentPostImageData = '';

    /* ==========================================================================
       1. BESUCHSZÄHLER (USER COUNTER MODULE)
       ========================================================================== */
    const initVisitorCounter = () => {
        let visits = parseInt(localStorage.getItem(STORAGE_VISITS)) || 0; // Start-Basiswert
        
        // Zähle bei neuem Aufruf in einer neuen Browser-Sitzung hoch
        if (!sessionStorage.getItem(SESSION_VISIT_KEY)) {
            visits++;
            localStorage.setItem(STORAGE_VISITS, visits);
            sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
        }

        // Zahl mit führenden Nullen formatieren (z.B. 001481)
        const formatted = String(visits).padStart(6, '0');
        const headerCounter = document.getElementById('header-visit-count');
        const sidebarCounter = document.getElementById('sidebar-visit-count');

        if (headerCounter) headerCounter.textContent = formatted;
        if (sidebarCounter) sidebarCounter.textContent = formatted;
    };

    /* ==========================================================================
       2. ADMIN & AUTHENTIFIZIERUNG MODULE
       ========================================================================== */
    /**
     * Ruft alle registrierten Admins aus dem LocalStorage ab.
     */
    const getAdmins = () => {
        const stored = localStorage.getItem(STORAGE_ADMINS);
        if (stored) return JSON.parse(stored);
        
        // Standard Master-Admin anlegen, falls noch keiner existiert
        const defaultAdmin = [{ username: 'Admin', pin: '////////', isMaster: true }];
        localStorage.setItem(STORAGE_ADMINS, JSON.stringify(defaultAdmin));
        return defaultAdmin;
    };

    /**
     * Rendert die Admin-Auswahlliste im Login-Formular.
     */
    const renderAdminSelectOptions = () => {
        const select = document.getElementById('login-admin-select');
        if (!select) return;

        const admins = getAdmins();
        select.innerHTML = '';
        admins.forEach(admin => {
            const opt = document.createElement('option');
            opt.value = admin.username;
            opt.textContent = admin.username + (admin.isMaster ? ' (Master)' : '');
            select.appendChild(opt);
        });
    };

    /**
     * Login-Prüfung durchführen.
     */
    const handleAdminLogin = (e) => {
        e.preventDefault();
        const selectedUser = document.getElementById('login-admin-select').value;
        const enteredPin = document.getElementById('login-pin-input').value;

        const admins = getAdmins();
        const foundAdmin = admins.find(a => a.username === selectedUser && a.pin === enteredPin);

        if (foundAdmin) {
            currentAdmin = foundAdmin.username;
            document.getElementById('login-pin-input').value = '';
            document.getElementById('admin-login-view').style.display = 'none';
            document.getElementById('admin-dashboard-view').style.display = 'flex';
            document.getElementById('current-admin-name').textContent = currentAdmin;
            
            // Verwalbare Liste rendern
            renderAdminPostsManagementList();
        } else {
            alert('FEHLER: Falscher PIN-Code für diesen Admin!');
        }
    };

    /**
     * Admin Ausloggen.
     */
    const handleAdminLogout = () => {
        currentAdmin = null;
        document.getElementById('admin-login-view').style.display = 'block';
        document.getElementById('admin-dashboard-view').style.display = 'none';
    };

    /**
     * Weiteren Admin anlegen.
     */
    const handleAddNewAdmin = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-admin-name').value.trim();
        const pin = document.getElementById('new-admin-pin').value.trim();

        if (!name || pin.length < 4) {
            alert('Bitte einen Namen und einen PIN mit mindestens 4 Zeichen eingeben.');
            return;
        }

        const admins = getAdmins();
        if (admins.some(a => a.username.toLowerCase() === name.toLowerCase())) {
            alert('Dieser Admin-Name existiert bereits.');
            return;
        }

        admins.push({ username: name, pin: pin, isMaster: false });
        localStorage.setItem(STORAGE_ADMINS, JSON.stringify(admins));
        
        alert(`Admin "${name}" wurde erfolgreich hinzugefügt!`);
        document.getElementById('add-admin-form').reset();
        renderAdminSelectOptions();
    };

    /* ==========================================================================
       3. POSTS / NACHRICHTEN & BILDER MANAGEMENT
       ========================================================================== */
    /**
     * Ruft alle Posts ab.
     */
    const getPosts = () => {
        const stored = localStorage.getItem(STORAGE_POSTS);
        if (stored) return JSON.parse(stored);
        
        // Erstbeitrag als Beispiel
        const initialPosts = [{
            id: 1,
            title: 'Willkommen bei DerRedGuardian Industries®',
            author: 'MasterGuardian',
            content: 'Das neue modulare Cyberpunk Terminal System ist nun online. Im Admin-Tab können verifizierte Admins neue Beiträge mit Bildern verfassen, bearbeiten oder verwalten.',
            imageUrl: '',
            timestamp: '[2026-08-08 // 12:00]'
        }];
        localStorage.setItem(STORAGE_POSTS, JSON.stringify(initialPosts));
        return initialPosts;
    };

    /**
     * Speichert die Posts im Storage und aktualisiert die Anzeigen.
     */
    const savePosts = (posts) => {
        localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
        renderPublicFeed();
        renderAdminPostsManagementList();
    };

    /**
     * Verarbeitet hochgeladene Bilddateien und konvertiert sie in Data-URL (Base64).
     */
    const handleImageFileInput = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentPostImageData = event.target.result;
                document.getElementById('preview-img-element').src = currentPostImageData;
                document.getElementById('image-preview-box').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    };

    /**
     * Beitrag Speichern (Sowohl Neuerstellung als auch Bearbeiten)
     */
    const handleSavePost = (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editing-post-id').value;
        const title = document.getElementById('post-title-input').value.trim();
        const content = document.getElementById('post-content-input').value.trim();
        const urlImage = document.getElementById('post-image-url').value.trim();

        // Bevorzugt Datei-Upload (Base64), ansonsten eingegebene URL
        const finalImage = currentPostImageData || urlImage;

        const posts = getPosts();

        if (editingId) {
            // Bearbeitung eines bestehenden Eintrags
            const index = posts.findIndex(p => p.id == editingId);
            if (index !== -1) {
                posts[index].title = title;
                posts[index].content = content;
                posts[index].imageUrl = finalImage;
                posts[index].lastEditedBy = currentAdmin;
            }
        } else {
            // Erstellung eines neuen Eintrags
            const now = new Date();
            const timestamp = `[${now.toISOString().split('T')[0]} // ${now.toTimeString().split(' ')[0].substring(0,5)}]`;
            posts.unshift({
                id: Date.now(),
                title: title,
                author: currentAdmin,
                content: content,
                imageUrl: finalImage,
                timestamp: timestamp
            });
        }

        savePosts(posts);
        resetPostForm();
    };

    /**
     * Setzt das Beitrags-Formular zurück.
     */
    const resetPostForm = () => {
        document.getElementById('post-editor-form').reset();
        document.getElementById('editing-post-id').value = '';
        currentPostImageData = '';
        document.getElementById('image-preview-box').style.display = 'none';
        document.getElementById('editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> NEUEN BEITRAG ERSTELLEN';
        document.getElementById('save-post-btn').innerHTML = '<i class="fa-solid fa-paper-plane"></i> VERÖFFENTLICHEN';
        document.getElementById('cancel-edit-btn').style.display = 'none';
    };

    /**
     * Bereitet einen Beitrag im Formular zum Bearbeiten vor.
     */
    const editPost = (id) => {
        const posts = getPosts();
        const post = posts.find(p => p.id == id);
        if (!post) return;

        document.getElementById('editing-post-id').value = post.id;
        document.getElementById('post-title-input').value = post.title;
        document.getElementById('post-content-input').value = post.content;
        document.getElementById('post-image-url').value = post.imageUrl.startsWith('http') ? post.imageUrl : '';

        if (post.imageUrl) {
            currentPostImageData = post.imageUrl;
            document.getElementById('preview-img-element').src = post.imageUrl;
            document.getElementById('image-preview-box').style.display = 'block';
        } else {
            currentPostImageData = '';
            document.getElementById('image-preview-box').style.display = 'none';
        }

        document.getElementById('editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> BEITRAG BEARBEITEN';
        document.getElementById('save-post-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> ÄNDERUNGEN SPEICHERN';
        document.getElementById('cancel-edit-btn').style.display = 'inline-flex';

        // Sanftes Scrollen zum Editor
        document.getElementById('post-editor-form').scrollIntoView({ behavior: 'smooth' });
    };

    /**
     * Löscht einen Beitrag.
     */
    const deletePost = (id) => {
        if (confirm('Soll dieser Beitrag wirklich unwiderruflich gelöscht werden?')) {
            let posts = getPosts();
            posts = posts.filter(p => p.id != id);
            savePosts(posts);
        }
    };

    /* ==========================================================================
       4. RENDERING MODULE (PUBLIC FEED & ADMIN LIST)
       ========================================================================== */
    /**
     * Rendert die Beiträge im öffentlichen Feed (Hauptseite Tab 1).
     */
    const renderPublicFeed = () => {
        const container = document.getElementById('public-feed-container');
        if (!container) return;

        const posts = getPosts();

        if (posts.length === 0) {
            container.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px;">Keine Nachrichten im Terminal verzeichnet.</p>`;
            return;
        }

        container.innerHTML = posts.map(post => `
            <article class="post-card">
                <div class="post-header">
                    <div>
                        <span class="post-author-badge"><i class="fa-solid fa-shield-halved"></i> ${escapeHTML(post.author)}</span>
                        <span style="font-size: 0.8rem; margin-left: 8px;">${post.timestamp}</span>
                    </div>
                </div>
                <h3 class="post-title">${escapeHTML(post.title)}</h3>
                <p class="post-content">${escapeHTML(post.content)}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-image" alt="Post Image">` : ''}
            </article>
        `).join('');
    };

    /**
     * Rendert die Liste der Beiträge zur Verwaltung im Admin-Dashboard.
     */
    const renderAdminPostsManagementList = () => {
        const container = document.getElementById('admin-posts-manage-list');
        if (!container) return;

        const posts = getPosts();

        if (posts.length === 0) {
            container.innerHTML = `<p style="color:var(--text-dim);">Keine Beiträge zum Bearbeiten vorhanden.</p>`;
            return;
        }

        container.innerHTML = posts.map(post => `
            <div class="admin-manage-item">
                <div>
                    <strong style="color:var(--neon-purple);">${escapeHTML(post.title)}</strong> 
                    <span style="font-size:0.8rem; color:var(--text-dim);">von ${escapeHTML(post.author)} am ${post.timestamp}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="cyber-button cyber-button-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="DRGApp.editPost(${post.id})">
                        <i class="fa-solid fa-pen"></i> Bearbeiten
                    </button>
                    <button class="cyber-button cyber-button-danger" onclick="DRGApp.deletePost(${post.id})">
                        <i class="fa-solid fa-trash"></i> Löschen
                    </button>
                </div>
            </div>
        `).join('');
    };

    /**
     * XSS-Schutz durch HTML-Escaping.
     */
    const escapeHTML = (str) => {
        return str ? str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag] || tag)) : '';
    };

    /* ==========================================================================
       5. TAB NAVIGATION & INITIALISIERUNG
       ========================================================================== */
    const initTabs = () => {
        const navButtons = document.querySelectorAll('.nav-btn[data-tab]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                
                navButtons.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    };

    const initEvents = () => {
        // Admin & Login Formular Events
        document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
        document.getElementById('admin-logout-btn').addEventListener('click', handleAdminLogout);
        document.getElementById('add-admin-form').addEventListener('submit', handleAddNewAdmin);
        
        // Post Editor Events
        document.getElementById('post-editor-form').addEventListener('submit', handleSavePost);
        document.getElementById('post-image-file').addEventListener('change', handleImageFileInput);
        document.getElementById('cancel-edit-btn').addEventListener('click', resetPostForm);

        // Cyber Tool Buttons
        const diagBtn = document.getElementById('system-diag-btn');
        const quickDiagBtn = document.getElementById('quick-diag-btn');
        const hashBtn = document.getElementById('hash-gen-btn');

        if (diagBtn) diagBtn.addEventListener('click', () => alert('System Diagnostics: Alle Knoten laufen optimal [100%].'));
        if (quickDiagBtn) quickDiagBtn.addEventListener('click', () => alert('Quick Diag: Node online. 0 Fehler.'));
        if (hashBtn) hashBtn.addEventListener('click', () => alert('Generierter Security Hash: ' + Math.random().toString(36).substring(2, 15).toUpperCase()));
    };

    /**
     * Öffentliche Initialisierungs-Methode
     */
    const init = () => {
        initVisitorCounter();
        initTabs();
        renderAdminSelectOptions();
        renderPublicFeed();
        initEvents();
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // 2. F12, Strg+Shift+I, Strg+Shift+J, Strg+U sperren
        document.addEventListener('keydown', (e) => {
          if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
          ) {
            e.preventDefault();
            return false;
          }
        });
        console.log('DerRedGuardian Industries® Terminal System gestartet.');
    };

    return {
        init,
        editPost,
        deletePost
    };

})();

// Starten des Systems, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', DRGApp.init);
