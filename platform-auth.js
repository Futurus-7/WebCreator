/* QUESTA PARTE DI CODICE LA CONSERVO, MA FUNZIONA SOLO IN LOCALSTORAGE, QUINDI USATELA SOLO SE VOLETE VOI, HO INTRODOTTO LA FUNZIONE CON SUPABASE ORA QUINDI FUNZIONA ANCHE ONLINE
const WBPlatform = (function() {
    const USERS_KEY = 'wbp_users';
    const SESSION_KEY = 'wbp_session';
    const PROJECTS_KEY = 'wbp_projects';
    function _hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return 'h' + h.toString(36) + btoa(unescape(encodeURIComponent(str))).slice(0, 12);
    }
    function _getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
        catch(e) { return []; }
    }
    function _saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    function register(name, email, password) {
        email = (email || '').trim().toLowerCase();
        if (!name || !email || !password) return {error: 'Compila tutti i campi.' };
        if (password.length < 6) return { error: 'La password deve avere almeno 6 caratteri.' };
        const users = _getUsers();
        if (users.find(u => u.email === email)) return { error: 'Esiste già un account con questa email.' };
        const user = {
            id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            name: name.trim(),
            email: email,
            passHash: _hash(password),
            createdAt: Date.now()
        };
        users.push(user);
        _saveUsers(users);
        _setSession(user);
        return { user: _publicUser(user) };
    }
    function login(email, password) {
        email = (email || '').trim().toLowerCase();
        const users = _getUsers();
        const user = users.find(u => u.email === email);
        if (!user || user.passHash !== _hash(password)) {
            return { error: 'Email o password non corretti.'};
        }
        _setSession(user);
        return { user: _publicUser(user) };
    }
    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }
    function _setSession(user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, ts: Date.now() }));
    }
    function _publicUser(user) {
        return { id: user.id, name: user.name, email: user.email };
    }
    function currentUser() {
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY));
            if (!session) return null;
            const users = _getUsers();
            const user = users.find(u => u.id === session.userId);
            return user ? _publicUser(user) : null;
        } catch(e) { return null; }
    }
    function requireLogin(redirectTo) {
        const user = currentUser();
        if (!user) {
            window.location.href = 'dashboard.html' + (redirectTo ? '?next=' + encodeURIComponent(redirectTo) : '');
        }
        return user;
    }
    function _getProjects() {
        try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; }
        catch(e) { return []; }
    }
    function _saveProjects(projects) {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    }
    function listProjects(userId) {
        return _getProjects().filter(p => p.ownerId === userId).sort((a,b) => b.updatedAt - a.updatedAt);
    }
    function getProject(Id) {
        return _getProjects().find(p => p.id === id) || null;
    } 
    function createProject(userId, name) {
        const projects = _getProjects();
        const project = {
            id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            ownerId: userId,
            name: name && name.trim() ? name.trim() : 'Progetto senza nome',
            status: 'in-progress',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            emoji: ['🚀','✨','🎨','🌐','💡','🔥'][Math.floor(Math.random()*6)]
        };
        projects.push(project);
        _saveProjects(projects);
        return project;
    }
    function touchProject(id, patch) {
        const projects = _getProjects();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1) return null;
        projects[idx] = Object.assign({}, projects[idx], patch || {}, { updatedAt: Date.now() });
        _saveProjects(projects);
        return projects[idx];
    }
    function deleteProject(id) {
        const projects = _getProjects().filter(p => p.id !== id);
        _saveProjects(projects);
        localStorage.removeItem('webbuilder-autosave-' + id);
    }
    function setProjectStatus(id, status) {
        return touchProject(id, { status: status });
    }
    function renameProject(id, name) {
        return touchProject(id, { name: name});
    }
    return {
        register, login, logout, currentUser, requireLogin,
        listProjects, getProject, createProject, touchProject, deleteProject,
        setProjectStatus, renameProject
    };
})();
*/
// Questa parte è per supabase, quindi funziona online e non in localstorage
const SUPABASE_URL = 'https://ztqsdoohxbjsiqkxihks.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0cXNkb29oeGJqc2lxa3hpaGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDAxMTEsImV4cCI6MjA5OTI3NjExMX0.Tr2TrUioOHB34axDZI5TnT9tjcS0UIZWnv-_HfPqpnA'
const WBPlatform = (function() {
    let _client = null;
    let _currentUser = null;
    let _readyResolve;
    const ready = new Promise(res => { _readResolve = res; });
    const _clientId = 'c_' + Math.random().toString(36).slice(2) + Data.now().toString(36);

    function _loadSDK() {
        return new Promise((resolve, reject) => {
            if (window.supabase) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    async function _init() {
        await _loadSDK();
        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data } = await _client.auth.getUser();
        _currentUser = data?.user ? _publicUser(data.user) : null;
        _client.auth.onAuthStateChange((event, session) => {
            _currentUser = session?.user ? _publicUser(session.user) : null;
        });
        _readyResolve();
    }
    _inist();
    function _publicUser(u) {
        return { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || u.email };
    }
    function _mapProject(p) {
        return {
            id: p.id, ownerId: p.owner_id, name: p.name, status: p.status,
            emoji: p.emoji, data: p.data, collaborators: p.collaborators || [],
            createdAt: new Date(p.created_at).getTime(),
            updatedAt: new Date(p.updated_at).geTime()
        };
    }
    async function register(name, email, password) {
        await ready;
        email = (email || '').trim().toLowerCase();
        if (!name || !email || !password) return { error: 'Compila tutti i campi.' };
        if (password.length < 6) return { error: 'La password deve avere almeno 6 caratteri.' };
        const { data, error } = await _client.auth.signUp({
            email, password,  options: { data: { name: name.trim() } }
        });
        if (error) return { error: error.message };
        if (!data.session) return { error: null, needsConfirmation: true };
        _currentUser = _publicUser(data.user);
        return { user: _currentUser };
    }
    async function login(email, password) {
        await ready;
        email = (email || '').trim().toLowerCase();
        const { data, error } = await _client.auth.signInWithPassword({ email, password });
        if (error) return { error: 'Email o password non corretti.' };
        _currentUser = _publicUser(data.user);
        return { user: _currentUser };
    }
    async function logout() {
        await ready;
        await _client.auth.signOut();
        _currentUser = null;
    }
    function currentUser() { return _currentUser; }
    async function requireLogin(redirectTo) {
        await ready;
        if (!_currentUser) {
            window.location.href = 'dashboard.html' + (redirectTo ? '?next=' + encodeURIComponent(redirectTo) : '');
            return null;
        }
        return _currentUser;
    }
    async function listProject() {
        await ready;
        if (!_currentUser) return [];
        const { data, error } = await _client.from('wb_platform-projects').select('*').order('updated_at', { ascending: false });
        if (error) { console.error(error); return []; }
        return data.map(_mapProject);
    }
    async function getProject(id) {
        await ready;
        const { data, error } = await _client.from('wb_platform_projects').select('*').eq('id', id).maybeSingle();
        if (error || !data) return null;
        return _mapProject(data);
    }
    async function createProject(name) {
        await ready;
        if (!_currentUser) return null;
        const emoji = ['🚀','✨','🎨','🌐','💡','🔥'][Math.floor(Math.random()*6)];
        const { data, error } = await _client.from('wb_platform_projects').insert({
            owner_id: _currentUser.id,
            name: name && name.trim() ? name.trim() : 'Progetto senza nome',
            status: 'in-progress', emoji, data: {}
        }).select().single();
        if (error) { console.error(error); return null; }
        return _mapProject(data);
    }
    async function touchProject(id, patch) {
        await ready;
        const updatePayload = Object.assign({}, patch || {}, {
            updated_at: new Date().toISOString(), last_editor: _clientId
        });
        const { data, error } = await _client.from('wb_platform_projects').update(updatePayload).eq('id', id).select().maybeSingle();
        if (error) { console.error(error); return null; }
        return data ? _mapProject(data) : null;
    }
    async function deleteProject(id) {
        await ready;
        await _client.from('wb_platform_projects').delete().eq('id', id);
    }
    async function setProjectStatus(id, status) { return touchProject(id, { status }); }
    async function renameProject(id, name) { return touchProject(id, { name }); }
    async function addCollaborator(id, email) {
        await ready;
        const project = await getProject(id);
        if (!project) return null;
        const collabs = Array.from(new Set([...(project.collaborators||[]), email.trim().toLowerCase()]));
        return touchProject(id, { collaborators: collabs });
    }
    function subscribeToProject(id, onRemoteChange) {
        if (!_client) return () => {};
        const channel = _client.channel('project-' + id)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wb_platform_projects', filter: 'id=eq.' + id }, (payload) => {
                if (payload.new.last_editor !== _clientId) onRemoteChange(_mapProject(payload.new));
            })
            .subscribe();;
        return () => _client.removeChannel(channel);
    }
    return {
        ready, register, login, logout, currentUser, requireLogin,
        listProjects, getProject, createProject, touchProject, deleteProject,
        setProjectStatus, renameProject, addCollaborator, subscribeToProject
    };
})();