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