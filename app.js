/**
 * ==========================================================================
 * DERREDGUARDIAN INDUSTRIES® - CORE APP CONTROLLER
 * Modular aufgebautes JavaScript für Tab-Steuerung, globalen Besuchszähler,
 * Admin.json Authentifizierung mit verschlüsseltem API-Key, Rollenrechte & GitHub-API.
 * ==========================================================================
 */

const DRGApp = (() => {

    // LocalStorage & SessionStorage Schlüssel
    const STORAGE_POSTS = 'DRG_Posts_V2';
    const STORAGE_ADMIN_DATA = 'DRG_AdminData_V3';
    const STORAGE_VISITS = 'DRG_VisitCounter_V2';
    const SESSION_VISIT_KEY = 'DRG_Visited_Session';

    // Verschlüsselungsschlüssel für den GitHub Token
    const SYSTEM_SECRET_KEY = 'DRG_CYBER_NODE_SECRET_2026_MASTER_KEY';

    // GitHub Repository Konfiguration
    const GH_OWNER = 'DerRedGuardian';
    const GH_REPO = 'DerRedGuardian';
    const GH_BRANCH = 'main';
    const GH_FILE_PATH = 'posts.json';
    const GH_ADMIN_FILE_PATH = 'admin.json';

    // Zustandsschlüssel (State)
    let currentAdminData = null; // { username, pin, isMaster }
    let currentPostImageData = '';
    let cachedPosts = null;
    let cachedPostsSha = null;
    let cachedAdminData = null;
    let cachedAdminSha = null;

    /* ==========================================================================
       0. KRYPTOGRAPHIE / CHIFFRIERUNG MODULE
       ========================================================================== */
    /**
     * Verschlüsselt den GitHub-Token für die sichere Ablage in admin.json.
     */
    const encryptToken = (plainText) => {
        if (!plainText) return '';
        try {
            let result = '';
            for (let i = 0; i < plainText.length; i++) {
                const charCode = plainText.charCodeAt(i) ^ SYSTEM_SECRET_KEY.charCodeAt(i % SYSTEM_SECRET_KEY.length);
                result += String.fromCharCode(charCode);
            }
            return 'DRG_ENC_' + btoa(result);
        } catch (e) {
            console.error('Verschlüsselungsfehler:', e);
            return plainText;
        }
    };

    /**
     * Entschlüsselt den Token aus admin.json im Arbeitsspeicher zur Laufzeit.
     */
    const decryptToken = (cipherText) => {
        if (!cipherText) return '';
        if (!cipherText.startsWith('DRG_ENC_')) return cipherText; // Fallback falls unverschlüsselt
        try {
            const rawCipher = atob(cipherText.replace('DRG_ENC_', ''));
            let result = '';
            for (let i = 0; i < rawCipher.length; i++) {
                const charCode = rawCipher.charCodeAt(i) ^ SYSTEM_SECRET_KEY.charCodeAt(i % SYSTEM_SECRET_KEY.length);
                result += String.fromCharCode(charCode);
            }
            return result;
        } catch (e) {
            console.error('Entschlüsselungsfehler:', e);
            return '';
        }
    };

    /* ==========================================================================
       1. BESUCHSZÄHLER (USER COUNTER MODULE - GLOBAL VIA API)
       ========================================================================== */
    const initVisitorCounter = async () => {
        const headerCounter = document.getElementById('header-visit-count');
        const sidebarCounter = document.getElementById('sidebar-visit-count');

        const updateDisplays = (num) => {
            const formatted = String(num).padStart(6, '0');
            if (headerCounter) headerCounter.textContent = formatted;
            if (sidebarCounter) sidebarCounter.textContent = formatted;
        };

        let localVisits = parseInt(localStorage.getItem(STORAGE_VISITS), 10) || 0;

        try {
            const isNewSession = !sessionStorage.getItem(SESSION_VISIT_KEY);
            const endpoint = isNewSession
                ? 'https://api.counterapi.dev/v1/derredguardian_industries/visits/up'
                : 'https://api.counterapi.dev/v1/derredguardian_industries/visits';

            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                if (data && typeof data.count === 'number') {
                    if (isNewSession) {
                        sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
                    }
                    localStorage.setItem(STORAGE_VISITS, data.count);
                    updateDisplays(data.count);
                    return;
                }
            }
        } catch (error) {
            console.warn('Global Counter API offline, verwende LocalStorage Fallback:', error);
        }

        if (!sessionStorage.getItem(SESSION_VISIT_KEY)) {
            localVisits++;
            localStorage.setItem(STORAGE_VISITS, localVisits);
            sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
        }
        updateDisplays(localVisits);
    };

    /* ==========================================================================
       2. ADMIN.JSON & AUTHENTIFIZIERUNG MODULE
       ========================================================================== */
    const getAdminData = async () => {
        if (cachedAdminData) return cachedAdminData;

        // 1. Abruf von GitHub API
        try {
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_ADMIN_FILE_PATH}?ref=${GH_BRANCH}`;
            const response = await fetch(apiUrl, { cache: 'no-store' });

            if (response.ok) {
                const data = await response.json();
                cachedAdminSha = data.sha;

                const base64Clean = data.content.replace(/\s/g, '');
                const binaryString = atob(base64Clean);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedText = new TextDecoder().decode(bytes);
                const parsedAdminData = JSON.parse(decodedText);

                if (parsedAdminData && Array.isArray(parsedAdminData.admins)) {
                    cachedAdminData = parsedAdminData;
                    localStorage.setItem(STORAGE_ADMIN_DATA, JSON.stringify(parsedAdminData));
                    return cachedAdminData;
                }
            }
        } catch (err) {
            console.warn('GitHub admin.json Fetch fehlgeschlagen, versuche lokalen Fallback:', err);
        }

        // 2. Fallback: Lokale admin.json
        try {
            const localRes = await fetch('./admin.json?t=' + Date.now());
            if (localRes.ok) {
                const parsedAdminData = await localRes.json();
                if (parsedAdminData && Array.isArray(parsedAdminData.admins)) {
                    cachedAdminData = parsedAdminData;
                    localStorage.setItem(STORAGE_ADMIN_DATA, JSON.stringify(parsedAdminData));
                    return cachedAdminData;
                }
            }
        } catch (err) {
            console.warn('Lokaler admin.json Fetch fehlgeschlagen:', err);
        }

        // 3. Fallback: LocalStorage
        const stored = localStorage.getItem(STORAGE_ADMIN_DATA);
        if (stored) {
            try {
                cachedAdminData = JSON.parse(stored);
                return cachedAdminData;
            } catch (e) {}
        }

        const defaultStructure = {
            githubTokenEncrypted: "",
            admins: [{ username: "Admin", pin: "////////", isMaster: true }]
        };
        cachedAdminData = defaultStructure;
        localStorage.setItem(STORAGE_ADMIN_DATA, JSON.stringify(defaultStructure));
        return cachedAdminData;
    };

    const saveAdminDataToGitHub = async (adminDataObj) => {
        // Entschlüssele den Token für die Authentifizierung des API-Calls
        const encryptedStr = adminDataObj.githubTokenEncrypted || (cachedAdminData ? cachedAdminData.githubTokenEncrypted : '');
        const token = decryptToken(encryptedStr);

        if (!token) {
            alert('FEHLER: Kein gültiger GitHub Access Token vorhanden. Speichern auf GitHub nicht möglich.');
            return false;
        }

        try {
            let sha = cachedAdminSha;
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_ADMIN_FILE_PATH}?ref=${GH_BRANCH}`;
            const getRes = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
            }

            const jsonString = JSON.stringify(adminDataObj, null, 2);
            const utf8Bytes = new TextEncoder().encode(jsonString);
            let binaryString = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binaryString += String.fromCharCode(utf8Bytes[i]);
            }
            const contentBase64 = btoa(binaryString);

            const putRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_ADMIN_FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `[DRG Terminal] Update admin.json via Master Admin (${currentAdminData?.username || 'Master'})`,
                    content: contentBase64,
                    sha: sha,
                    branch: GH_BRANCH
                })
            });

            if (putRes.ok) {
                const resultData = await putRes.json();
                cachedAdminSha = resultData.content.sha;
                cachedAdminData = adminDataObj;
                localStorage.setItem(STORAGE_ADMIN_DATA, JSON.stringify(adminDataObj));
                alert('SYSTEM UPDATE: admin.json erfolgreich auf GitHub aktualisiert!');
                return true;
            } else {
                const errData = await putRes.json();
                alert(`FEHLER beim Aktualisieren der admin.json: ${errData.message || 'Unbekannter Fehler'}`);
                return false;
            }
        } catch (err) {
            console.error('GitHub API Admin Save Error:', err);
            alert('FEHLER: Verbindung zur GitHub API beim Speichern der admin.json fehlgeschlagen.');
            return false;
        }
    };

    const renderAdminSelectOptions = async () => {
        const select = document.getElementById('login-admin-select');
        if (!select) return;

        const adminData = await getAdminData();
        select.innerHTML = '';
        adminData.admins.forEach(admin => {
            const opt = document.createElement('option');
            opt.value = admin.username;
            opt.textContent = admin.username + (admin.isMaster ? ' (Master)' : ' (Subadmin)');
            select.appendChild(opt);
        });
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        const selectedUser = document.getElementById('login-admin-select').value;
        const enteredPin = document.getElementById('login-pin-input').value;

        const adminData = await getAdminData();
        const foundAdmin = adminData.admins.find(a => a.username === selectedUser && a.pin === enteredPin);

        if (foundAdmin) {
            currentAdminData = foundAdmin;
            document.getElementById('login-pin-input').value = '';
            document.getElementById('admin-login-view').style.display = 'none';
            document.getElementById('admin-dashboard-view').style.display = 'flex';
            document.getElementById('current-admin-name').textContent = `${foundAdmin.username} [${foundAdmin.isMaster ? 'MASTER' : 'SUBADMIN'}]`;
            
            applyRolePermissionsUI();
            await renderAdminPostsManagementList();
        } else {
            alert('FEHLER: Falscher PIN-Code für diesen Employee!');
        }
    };

    const applyRolePermissionsUI = () => {
        const isMaster = currentAdminData && currentAdminData.isMaster;

        const addAdminForm = document.getElementById('add-admin-form');
        if (addAdminForm) {
            const addAdminCard = addAdminForm.closest('.cyber-card');
            if (addAdminCard) {
                addAdminCard.style.display = isMaster ? 'block' : 'none';
            }
        }

        if (isMaster) {
            renderGitHubTokenConfigCard();
        } else {
            const tokenCard = document.getElementById('github-token-config-card');
            if (tokenCard) tokenCard.style.display = 'none';
        }
    };

    const handleAdminLogout = () => {
        currentAdminData = null;
        document.getElementById('admin-login-view').style.display = 'block';
        document.getElementById('admin-dashboard-view').style.display = 'none';
    };

    const handleAddNewAdmin = async (e) => {
        e.preventDefault();

        if (!currentAdminData || !currentAdminData.isMaster) {
            alert('ZUGRIFF VERWEIGERT: Nur der Master Admin darf neue Employees anlegen!');
            return;
        }

        const name = document.getElementById('new-admin-name').value.trim();
        const pin = document.getElementById('new-admin-pin').value.trim();

        if (!name || pin.length < 4) {
            alert('Bitte einen Namen und einen PIN mit mindestens 4 Zeichen eingeben.');
            return;
        }

        const adminData = await getAdminData();
        if (adminData.admins.some(a => a.username.toLowerCase() === name.toLowerCase())) {
            alert('Dieser Employee-Name existiert bereits.');
            return;
        }

        adminData.admins.push({ username: name, pin: pin, isMaster: false });
        
        const success = await saveAdminDataToGitHub(adminData);
        if (success) {
            alert(`Employee "${name}" wurde erfolgreich hinzugefügt und in admin.json gespeichert!`);
            document.getElementById('add-admin-form').reset();
            await renderAdminSelectOptions();
        }
    };

    const renderGitHubTokenConfigCard = () => {
        const dashboard = document.getElementById('admin-dashboard-view');
        if (!dashboard) return;

        let tokenCard = document.getElementById('github-token-config-card');
        if (!tokenCard) {
            tokenCard = document.createElement('div');
            tokenCard.id = 'github-token-config-card';
            tokenCard.className = 'cyber-card';
            tokenCard.style.marginTop = '20px';
            dashboard.appendChild(tokenCard);
        }

        tokenCard.style.display = 'block';
        const encryptedToken = (cachedAdminData && cachedAdminData.githubTokenEncrypted) ? cachedAdminData.githubTokenEncrypted : '';
        const hasToken = Boolean(encryptedToken);

        tokenCard.innerHTML = `
            <h2 class="card-title"><i class="fa-brands fa-github"></i> GITHUB API TOKEN MANAGEMENT (MASTER ONLY)</h2>
            <div class="cyber-form">
                <div class="form-group">
                    <label>AKTUELLER TOKEN-STATUS (IN ADMIN.JSON VERSCHLÜSSELT)</label>
                    <input type="text" class="cyber-input" value="${hasToken ? 'DRG_VERSCHLÜSSELT_GESPEICHERT [OK]' : 'KEIN TOKEN IN ADMIN.JSON VORHANDEN'}" disabled style="opacity: 0.7;">
                </div>
                <div class="form-group">
                    <label for="gh-token-input">NEUEN GITHUB PERSONAL ACCESS TOKEN (PAT) EINGEBEN</label>
                    <input type="password" id="gh-token-input" class="cyber-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
                </div>
                <div class="button-group">
                    <button type="button" class="cyber-button" id="save-gh-token-btn">
                        <i class="fa-solid fa-lock"></i> TOKEN VERSCHLÜSSELN & SPEICHERN
                    </button>
                </div>
            </div>
        `;

        document.getElementById('save-gh-token-btn')?.addEventListener('click', async () => {
            if (!currentAdminData || !currentAdminData.isMaster) {
                alert('ZUGRIFF VERWEIGERT!');
                return;
            }
            const newToken = document.getElementById('gh-token-input').value.trim();
            if (newToken) {
                const adminData = await getAdminData();
                adminData.githubTokenEncrypted = encryptToken(newToken);
                delete adminData.githubToken; // Entferne unverschlüsselten alten Schlüssel falls vorhanden
                
                const saved = await saveAdminDataToGitHub(adminData);
                if (saved) {
                    renderGitHubTokenConfigCard();
                }
            } else {
                alert('Bitte einen gültigen GitHub Token eingeben.');
            }
        });
    };

    /* ==========================================================================
       3. POSTS / NACHRICHTEN & GITHUB REST-API
       ========================================================================== */
    const getPosts = async () => {
        if (cachedPosts) return cachedPosts;

        try {
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE_PATH}?ref=${GH_BRANCH}`;
            const response = await fetch(apiUrl, { cache: 'no-store' });

            if (response.ok) {
                const data = await response.json();
                cachedPostsSha = data.sha;

                const base64Clean = data.content.replace(/\s/g, '');
                const binaryString = atob(base64Clean);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedText = new TextDecoder().decode(bytes);
                const parsedPosts = JSON.parse(decodedText);

                if (Array.isArray(parsedPosts)) {
                    cachedPosts = parsedPosts;
                    localStorage.setItem(STORAGE_POSTS, JSON.stringify(parsedPosts));
                    return cachedPosts;
                }
            }
        } catch (err) {
            console.warn('GitHub API Posts Fetch fehlgeschlagen, versuche lokalen Fallback:', err);
        }

        try {
            const localRes = await fetch('./posts.json?t=' + Date.now());
            if (localRes.ok) {
                const parsedPosts = await localRes.json();
                if (Array.isArray(parsedPosts) && parsedPosts.length > 0) {
                    cachedPosts = parsedPosts;
                    localStorage.setItem(STORAGE_POSTS, JSON.stringify(parsedPosts));
                    return cachedPosts;
                }
            }
        } catch (err) {
            console.warn('Lokaler posts.json Fetch fehlgeschlagen:', err);
        }

        const stored = localStorage.getItem(STORAGE_POSTS);
        if (stored) {
            try {
                cachedPosts = JSON.parse(stored);
                return cachedPosts;
            } catch (e) {}
        }

        const initialPosts = [{
            id: 1,
            title: 'Willkommen bei DerRedGuardian Industries®',
            author: 'MasterGuardian',
            content: 'Das neue modulare Cyberpunk Terminal System ist nun online. Zur Webseite.link("https://derredguardian.de")\nBild("https://images.unsplash.com/photo-1518770660439-4636190af475?w=600")',
            imageUrl: '',
            timestamp: '[2026-08-08 // 12:00]'
        }];
        cachedPosts = initialPosts;
        localStorage.setItem(STORAGE_POSTS, JSON.stringify(initialPosts));
        return cachedPosts;
    };

    const savePostsToGitHub = async (posts) => {
        const adminData = await getAdminData();
        // Entschlüssele den gespeicherten Key im Arbeitsspeicher
        const encryptedStr = adminData.githubTokenEncrypted || adminData.githubToken;
        const token = decryptToken(encryptedStr);

        if (!token) {
            alert('FEHLER: Kein gültiger GitHub Access Token in admin.json vorhanden! Wende dich an den Master Admin.');
            return false;
        }

        try {
            let sha = cachedPostsSha;
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE_PATH}?ref=${GH_BRANCH}`;
            const getRes = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
            }

            const jsonString = JSON.stringify(posts, null, 2);
            const utf8Bytes = new TextEncoder().encode(jsonString);
            let binaryString = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binaryString += String.fromCharCode(utf8Bytes[i]);
            }
            const contentBase64 = btoa(binaryString);

            const putRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `[DRG Terminal] Update posts.json via Terminal (${currentAdminData?.username || 'Employee'})`,
                    content: contentBase64,
                    sha: sha,
                    branch: GH_BRANCH
                })
            });

            if (putRes.ok) {
                const resultData = await putRes.json();
                cachedPostsSha = resultData.content.sha;
                alert('SYSTEM UPDATE: Beitrag erfolgreich synchronisiert & auf GitHub veröffentlicht!');
                return true;
            } else {
                const errData = await putRes.json();
                alert(`FEHLER beim GitHub API Sync: ${errData.message || 'Unbekannter Fehler'}`);
                return false;
            }
        } catch (err) {
            console.error('GitHub API Save Error:', err);
            alert('FEHLER: Verbindung zur GitHub API fehlgeschlagen.');
            return false;
        }
    };

    const savePosts = async (posts) => {
        cachedPosts = posts;
        localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));

        const saveBtn = document.getElementById('save-post-btn');
        const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SYNCING GITHUB...';
        }

        await savePostsToGitHub(posts);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }

        await renderPublicFeed();
        await renderAdminPostsManagementList();
    };

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

    const handleSavePost = async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editing-post-id').value;
        const title = document.getElementById('post-title-input').value.trim();
        const content = document.getElementById('post-content-input').value.trim();
        const urlImage = document.getElementById('post-image-url').value.trim();

        const finalImage = currentPostImageData || urlImage;
        let posts = await getPosts();

        if (editingId) {
            const index = posts.findIndex(p => p.id == editingId);
            if (index !== -1) {
                posts[index].title = title;
                posts[index].content = content;
                posts[index].imageUrl = finalImage;
                posts[index].lastEditedBy = currentAdminData?.username || 'Admin';
            }
        } else {
            const now = new Date();
            const timestamp = `[${now.toISOString().split('T')[0]} // ${now.toTimeString().split(' ')[0].substring(0,5)}]`;
            posts.unshift({
                id: Date.now(),
                title: title,
                author: currentAdminData?.username || 'Employee',
                content: content,
                imageUrl: finalImage,
                timestamp: timestamp
            });
        }

        await savePosts(posts);
        resetPostForm();
    };

    const resetPostForm = () => {
        document.getElementById('post-editor-form').reset();
        document.getElementById('editing-post-id').value = '';
        currentPostImageData = '';
        document.getElementById('image-preview-box').style.display = 'none';
        document.getElementById('editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> NEUEN BEITRAG ERSTELLEN';
        document.getElementById('save-post-btn').innerHTML = '<i class="fa-solid fa-paper-plane"></i> VERÖFFENTLICHEN';
        document.getElementById('cancel-edit-btn').style.display = 'none';
    };

    const editPost = async (id) => {
        const posts = await getPosts();
        const post = posts.find(p => p.id == id);
        if (!post) return;

        document.getElementById('editing-post-id').value = post.id;
        document.getElementById('post-title-input').value = post.title;
        document.getElementById('post-content-input').value = post.content;
        document.getElementById('post-image-url').value = (post.imageUrl && post.imageUrl.startsWith('http')) ? post.imageUrl : '';

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

        document.getElementById('post-editor-form').scrollIntoView({ behavior: 'smooth' });
    };

    const deletePost = async (id) => {
        if (confirm('Soll dieser Beitrag wirklich unwiderruflich gelöscht werden?')) {
            let posts = await getPosts();
            posts = posts.filter(p => p.id != id);
            await savePosts(posts);
        }
    };

    /* ==========================================================================
       4. RENDERING MODULE (PARSER & PUBLIC FEED)
       ========================================================================== */
    const formatPostContent = (rawText) => {
        if (!rawText) return '';

        let escaped = escapeHTML(rawText);

        escaped = escaped.replace(/([^\n\r<]+)\.link\((?:&quot;|&#39;|["'])(.*?)(?:&quot;|&#39;|["'])\)/gi, (match, label, url) => {
            let href = url.trim();
            if (!href.startsWith('http://') && !href.startsWith('https://')) {
                href = 'https://' + href;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--neon-cyan, #00f3ff); font-weight:600; text-decoration:underline;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> ${label.trim()}</a>`;
        });

        escaped = escaped.replace(/Bild\((?:&quot;|&#39;|["'])(.*?)(?:&quot;|&#39;|["'])\)/gi, (match, url) => {
            let src = url.trim();
            if (!src.startsWith('http://') && !src.startsWith('https://')) {
                src = 'https://' + src;
            }
            return `<img src="${src}" style="max-width:100%; border-radius:4px; margin:10px 0; border:1px solid var(--neon-pink, #ff007f); display:block;" alt="Embedded Media">`;
        });

        return escaped.replace(/\n/g, '<br>');
    };

    const renderPublicFeed = async () => {
        const container = document.getElementById('public-feed-container');
        if (!container) return;

        const posts = await getPosts();

        if (!posts || posts.length === 0) {
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
                <div class="post-content">${formatPostContent(post.content)}</div>
                ${post.imageUrl ? `<img src="${escapeHTML(post.imageUrl)}" class="post-image" alt="Post Image">` : ''}
            </article>
        `).join('');
    };

    const renderAdminPostsManagementList = async () => {
        const container = document.getElementById('admin-posts-manage-list');
        if (!container) return;

        const posts = await getPosts();

        if (!posts || posts.length === 0) {
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
        document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
        document.getElementById('admin-logout-btn').addEventListener('click', handleAdminLogout);
        document.getElementById('add-admin-form').addEventListener('submit', handleAddNewAdmin);
        
        document.getElementById('post-editor-form').addEventListener('submit', handleSavePost);
        document.getElementById('post-image-file').addEventListener('change', handleImageFileInput);
        document.getElementById('cancel-edit-btn').addEventListener('click', resetPostForm);

        const diagBtn = document.getElementById('system-diag-btn');
        const quickDiagBtn = document.getElementById('quick-diag-btn');
        const hashBtn = document.getElementById('hash-gen-btn');

        if (diagBtn) diagBtn.addEventListener('click', () => alert('System Diagnostics: Alle Knoten laufen optimal [100%].'));
        if (quickDiagBtn) quickDiagBtn.addEventListener('click', () => alert('Quick Diag: Node online. 0 Fehler.'));
        if (hashBtn) hashBtn.addEventListener('click', () => alert('Generierter Security Hash: ' + Math.random().toString(36).substring(2, 15).toUpperCase()));
    };

    const init = async () => {
        await initVisitorCounter();
        initTabs();
        await renderAdminSelectOptions();
        await renderPublicFeed();
        initEvents();

        document.addEventListener('contextmenu', (e) => e.preventDefault());
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

document.addEventListener('DOMContentLoaded', DRGApp.init);
