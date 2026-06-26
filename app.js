const state = {
    selectedElement: null,
    clipboard: null,
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    draggedType: null,
    draggedElement: null,
    elementCounter: 0
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const canvas = $('#canvas');
const canvasEmpty = $('#canvasEmpty');
const canvasWrapper = $('#canvasWrapper');
const panelEmpty = $('#panelEmpty');
const propertiesContent = $('#propertiesContent');
const contextMenu = $('#contextMenu');
const layersPanel = $('#layersPanel');
const layersTree = $('#layersTree');
const previewModal = $('#previewModal');
const exportModal = $('#exportModal');
const previewFrame = $('#previewFrame');
const codeOutput = $('#codeOutput');
let currentMode = 'structure'
let structureHTML = '';
let freeHTML = '';
let pages = [
    { name: 'Pagina 1', structureHTML: '', freeHTML: '' }
];
let currentPageIndex = 0;
let advancedConfig = {
    roles: ['user', 'premium', 'moderator', 'admin'],
    defaultRole: 'user',
    blogEnabled: true,
    blogPostsPerPage: 10,
    blogPublishRole: 'user',
    blogModerateRole: 'moderator',
    blogModeration: 'none',
    blogCategories: []
};

function parseOptionActionsText(text) {
    const actions = {};
    (text || '').split('\n').forEach(line => {
        const parts = line.split('|').map(part => part.trim());
        const label = parts[0] || '';
        const action = parts[1] || 'none';
        const value = parts[2] || '';
        const newTab = parts[3] === 'true';
        if (!label || action === 'none') return;
        actions[label] = {
            action,
            value,
            newTab
        };
    });
    return actions;
}
function optionActionsToText(jsonText) {
    if (!jsonText) return '';
    try {
        const actions = JSON.parse(jsonText);
        return Object.entries(actions).map(([label, config]) => {
            return [
                label,
                config.action || 'none',
                config.value || '',
                config.newTab ? 'true' : 'false'
            ].join(' | ');
        }).join('\n');
    } catch (e) {
        return '';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initToolbar();
    initViewport();
    initPlatformWarning();
    initPanelSections();
    initPropertyTabs();
    initPropertyInputs();
    initContextMenu();
    initLayers();
    initModals();
    initKeyboard();
    initModes();
    initFreeToolbar();
    initPages();
    initCanvasResize();
    initTouchDragAndDrop();
    initFunctions();
    setInterval(autoSave, 5000);
    const loaded = autoLoad();
    if (!loaded) {
        saveHistory();
    }
});
    function fallbackCopy(text, onSuccess) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
    try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
    } catch (e) {
        alert('Copia automatica non riuscita. Seleziona il codice e copialo manualmente.');
    }
    document.body.removeChild(textarea)
}

function initDragAndDrop() {
    $$('.draggable-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            state.draggedType = item.dataset.type;
            state.draggedElement = null;
            e.dataTransfer.effectAllowed = 'copy';
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', (e) => {
            state.draggedType = null;
            item.style.opacity = '1';
            removeAllDropIndicators();
        });
    });

    canvas.addEventListener('dragover', handleCanvasDragOver);
    canvas.addEventListener('dragleave', handleCanvasDragLeave);
    canvas.addEventListener('drop', handleCanvasDrop);
}

function initTouchDragAndDrop() {
    let touchDragType = null;
    let touchGhost = null;

    $$('.draggable-item').forEach(item => {
        item.addEventListener('touchstart', (e) => {
            touchDragType = item.dataset.type;
            const touch = e.touches[0];
            touchGhost = item.cloneNode(true);
            touchGhost.style.cssText = `
                position: fixed;
                left: ${touch.clientX - 40}px;
                top: ${touch.clientY - 40}px;
                width: 80px;
                opacity: 0.7;
                pointer-events: none;
                z-index: 9999;
                background: var(--accent-light);
                border: 1px solid var(--accent);
                border-radius: 8px;
            `;
            document.body.appendChild(touchGhost);
        }, { passive: true });
        item.addEventListener('touchmove', (e) => {
            if (!touchGhost) return;
            e.preventDefault();
            const touch = e.touches[0];
            touchGhost.style.left = (touch.clientX - 40) + 'px';
            touchGhost.style.top = (touch.clientY - 40) + 'px';
        }, { passive: false });
        
        item.addEventListener('touchend', (e) => {
            if (touchGhost) { touchGhost.remove(); touchGhost = null; }
            if (!touchDragType) return;
            const touch = e.changedTouches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const canvasEl = el ? el.closest('#canvas') : null;
            if (canvasEl) {
                const newElement = createElement(touchDragType);
                canvas.appendChild(newElement);
                finalizeDrop(newElement);
            }
            touchDragType = null;
        });
    });
}

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const scrollZone = 80;
    const speed = 12;
    const canvasRect = canvas.getBoundingClientRect();
    if (e.clientY > canvasRect.bottom - scrollZone) {
        canvas.parentElement.scrollTop += speed;
    } else if (e.clientY < canvasRect.top + scrollZone) {
        canvas.parentElement.scrollTop -= speed;
    }
    const target = getDropTarget(e);
    if (!target) {
        removeAllDropIndicators();
        return;
    }
    if (state.draggedElement && (target === state.draggedElement || state.draggedElement.contains(target))) {
        return;
    }
    const rect = target.getBoundingClientRect();
    if (isContainer(target)) {
        const innerZone = rect.height * 0.3;
        if (e.clientY > rect.top + innerZone && e.clientY < rect.bottom - innerZone) {
            removeAllDropIndicators();
            target.classList.add('drag-over');
            return;
        }
    }
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    const existingIndicator = canvas.querySelector('.drop-indicator');
    if (existingIndicator) {
        const prevSibling = existingIndicator.previousElementSibling;
        const nextSibling = existingIndicator.nextElementSibling;
        if (position === 'before' && nextSibling === target) return;
        if (position === 'after' && prevSibling === target) return;
    }
    removeAllDropIndicators();
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (position === 'before') {
        target.parentNode.insertBefore(indicator, target);
    } else {
        target.parentNode.insertBefore(indicator, target.nextSibling);
    }
}

function handleCanvasDragLeave(e) {
    if (!canvas.contains(e.relatedTarget)) {
        removeAllDropIndicators();
    }
}

function handleCanvasDrop(e) {
    e.preventDefault();
    removeAllDropIndicators();

    const target = getDropTarget(e);
    let newElement;
    if (state.draggedType) {
        newElement = createElement(state.draggedType);
    } else if (state.draggedElement) {
        newElement = state.draggedElement;
    }

    if (!newElement) return;
    if (target && newElement.contains(target)) return;
    if (target && target !== newElement) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (isContainer(target)) {
            const innerZone = rect.height * 0.3;
            if (e.clientY > rect.top + innerZone && e.clientY < rect.bottom - innerZone) {
                target.appendChild(newElement);
                finalizeDrop(newElement);
                return;
            }
        }

        if (e.clientY < midY) {
            target.parentNode.insertBefore(newElement, target);
        } else {
            target.parentNode.insertBefore(newElement, target.nextSibling);
        }
    } else {
        canvas.appendChild(newElement);
    }

    finalizeDrop(newElement);
}

function finalizeDrop(element) {
    hideCanvasEmpty();
    selectElement(element);
    saveHistory();
    updateLayers();
    state.draggedType = null;
    state.draggedElement = null;
}

function getDropTarget(e) {
    let target = document.elementFromPoint(e.clientX, e.clientY);
    while (target && target !== canvas) {
        if (target.classList && target.classList.contains('builder-element')) {
            return target;
        }
        target = target.parentElement;
    }
    return null;
}

function isContainer(el) {
    if (!el) return false;
    const type= el.dataset.type;
    const containers= [
        'section', 'container', 'columns-2', 'columns-3',
        'grid', 'form', 'block-hero', 'block-navbar', 'block-footer',
        'block-card', 'block-pricing', 'block-testimonial'
    ];
    return containers.includes(type);
}

function removeAllDropIndicators() {
    $$('.drop-indicator').forEach(el => el.remove());
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function hideCanvasEmpty() {
    const empty = canvas.querySelector('.canvas-empty');
    if (empty) {
        empty.style.display = 'none';
    }
}

function showCanvasEmpty() {
    const elements = canvas.querySelectorAll('.builder-element');
    const empty = canvas.querySelector('.canvas-empty');
    if (elements.length === 0 && empty) {
        empty.style.display = 'flex';
    }
}

function createElement(type) {
    state.elementCounter++;
    const id = 'el-' + state.elementCounter;

    const wrapper = document.createElement('div');
    wrapper.className = 'builder-element';
    wrapper.dataset.type = type;
    wrapper.dataset.id = id;
    wrapper.dataset.label = getTypeLabel(type);
   if (currentMode === 'free') {
        wrapper.draggable = false;
    } else {
        wrapper.draggable = true;
    }
    if (type === 'background') {
        wrapper.classList.add('visual-background');
        wrapper.setAttribute('aria-hidden', 'true');
        wrapper.style.position = 'absolute';
        wrapper.style.inset = '0';
        wrapper.style.zIndex = '0';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.pointerEvents = 'auto';
        wrapper.draggable = false;
    }

    wrapper.innerHTML = getElementHTML(type);

    const actions = document.createElement('div');
    actions.className = 'element-actions';
    actions.innerHTML = `
        <button class="element-action-btn" data-action="moveup" title="Sposta su"><i class="fa-solid fa-arrow-up"></i></button>
        <button class="element-action-btn" data-action="movedown" title="Sposta giu"><i class="fa-solid fa-arrow-down"></i></button>
        <button class="element-action-btn" data-action="duplicate" title="Duplica"><i class="fa-solid fa-clone"></i></button>
        <button class="element-action-btn action-delete" data-action="delete" title="Elimina"><i class="fa-solid fa-trash"></i></button>
        `;
    wrapper.appendChild(actions);
    setupElementEvents(wrapper);
    if (currentMode === 'free') {
        wrapper.style.position = 'absolute';
        wrapper.style.left = '50px';
        wrapper.style.top = '50px';
        addResizeHandles(wrapper);
        addFreeDrag(wrapper);
    }
    return wrapper;
}

function getTypeLabel(type) {
    const labels = {
        'section': 'Sezione',
        'container': 'Contenitore',
        'columns-2': '2 Colonne',
        'columns-3': '3 Colonne',
        'grid': 'Griglia',
        'heading': 'Titolo',
        'paragraph': 'Paragrafo',
        'image': 'Immagine',
        'button': 'Bottone',
        'link': 'Link',
        'divider': 'Divisore',
        'spacer': 'Spazio',
        'video': 'Video',
        'icon': 'Icona',
        'map': 'Mappa',
        'background': 'Background',
        'form-contact': 'Modulo Contatti',
        'input': 'Campo testo',
        'textarea': 'Area testo',
        'select': 'Menu a tendina',
        'checkbox': 'Checkbox',
        'block-hero': 'Hero',
        'block-navbar': 'Navbar',
        'block-footer': 'Footer',
        'block-card': 'Card',
        'block-pricing': 'Pricing',
        'block-testimonial': 'Testimonial',
        'block-login': 'Form Login',
        'block-register': 'Form Registrazione',
        'block-logout': 'Bottone Logout',
        'block-protected': 'Sezione Protetta',
        'block-role-gate': 'Gate Ruolo',
        'block-user-profile': 'Profilo Utente',
        'block-progress': 'Barra Progressi',
        'block-blog-list': 'Lista Blog',
        'block-blog-editor': 'Editor Blog',
        'block-user-data': 'Dato Utente',
        'block-leaderboard': 'Classifica',
        'block-admin': 'Pannello Admin',
        'block-product-list': 'Catalogo Prodotti',
        'block-product-card': 'Prodotto Singolo',
        'block-cart': 'Carrello',
        'block-booking-form': 'Form Prenotazione',
        'block-booking-admin': 'Gestione Prenotazione',
        'block-payment': 'Widget Pagamento',
        'block-stripe-btn': 'Bottone Stripe',
        'block-paypal-btn': 'Bottone PayPal',
        'block-newsletter': 'Newsletter'
    };
    return labels[type] || type;
}

function getElementHTML(type) {
    const templates = {
        'section': '<div class="wb-section"></div>',
        'container': '<div class="wb-container"></div>',
        'columns-2': `
            <div class="wb-columns">
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 1" draggable="true"></div>
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 2" draggable="true"></div>
            </div>`,
        'columns-3': `
            <div class="wb-columns">
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 1" draggable="true"></div>
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 2" draggable="true"></div>
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 3" draggable="true"></div>
            </div>`,

            'grid': '<div class="wb-grid"></div>',
            'heading': '<h2 class="wb-heading" contenteditable="true">Scrivi il tuo titolo</h2>',
            'paragraph': '<p class="wb-paragraph" contenteditable="true">Scrivi il tuo paragrafo qui. Clicca per modificare il testo direttamente.</p>',

            'image': `
                    <div class="wb-image">
                        <div class="wb-image-placeholder">
                            <span><i class="fa-solid fa-image"></i> Clicca per aggiungere un\'immagine</span>
                        </div>
                    </div>`,

                'button': '<button class="wb-button" contenteditable="true">Clicca qui</button>',
                'link': '<a class="wb-link" contenteditable="true" href="#">Il tuo link</a>',
                'divider': '<hr class="wb-divider">',
                'spacer': '<div class="wb-spacer"></div>',
                'video': `
                    <div class="wb-video">
                        <span><i class="fa-solid fa-play-circle" style="font-size:48px;color:#666;"></i></span>
                    </div>`,
                'icon': '<div class="wb-icon"><i class="fa-solid fa-star"></i></div>',
                'map': '<div class="wb-map"><span><i class="fa-solid fa-map-location-dot"></i>Mappa</span></div>',
                'background': '<div class="wb-background"></div>',
                'form': '<form class="wb-form" onsubmit="return false;"></form>',
                'form-contact': `
                    <form class="wb-form" onsubmit="return false;" style="max-width:500px;">
                        <h3 style="margin-bottom:16px;font-size:20px;color:#333;">Contatateci</h3>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Nome *</label>
                            <input type="text" name="nome" class="wb-input" placeholder="Il Tuo nome" required>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Email *</label>
                            <input type="email" name="email" class="wb-input" placeholder="la-tua@email.com" required>
                        </div>
                        <div style="margin-bottom:16px;">
                            <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Messaggio *</label>
                            <textarea name="messaggio" class="wb-textarea-el" placeholder="Scrivi il tuo messaggio..." rows="4" required></textarea>
                        </div>
                        <button type="submit" class="wb-button" style="width:100%;cursor:pointer;">Invia messaggio</button>
                    </form>`,
                'input': '<input type="text" class="wb-input" placeholder="Inserisci testo...">',
                'textarea': '<textarea class="wb-textarea-el" placeholder="Scrivi qui..."></textarea>',
                'select': `
                    <select class="wb-select">
                        <option>Opzione 1</option>
                        <option>Opzione 2</option>
                        <option>Opzione 3</option>
                    </select>`,
                'checkbox': `
                    <label class="wb-checkbox-wrapper">
                        <input type="checkbox">Accetto i termini
                    </label>`,
                'block-hero': `
                    <div class="wb-hero">
                        <h1 contenteditable="true">Il tuo titolo principale</h1>
                        <p contenteditable="true">Una descrizione breve e convincente del tuo progetto o della tua attivita.</p>
                        <button class="hero-btn" contenteditable="true">Inizia ora</button>
                    </div>`,
                'block-navbar': `
                    <nav class="wb-navbar">
                        <span class="nav-brand" contenteditable="true">Il Tuo Brand</span>
                        <ul class="nav-links">
                            <li><a href="#" contenteditable="true">Home</a></li>
                            <li><a href="#" contenteditable="true">Chi siamo</a></li>
                            <li><a href="#" contenteditable="true">Servizi</a></li>
                            <li><a href="#" contenteditable="true">Contatti</a></li>
                        </ul>
                    </nav>`,

                'block-footer': `
                    <footer class="wb-footer">
                        <p contenteditable="true">Il Tuo brand - Tutti i diritti riservati </p>
                        <p contenteditable="true">info@esempio.com</p>
                    </footer>`,

                'block-card': `
                    <div class="wb-card">
                        <div class="card-img"><i class="fa-solid fa-image" style="font-size:32px;color:#ccc;"></i></div>
                        <div class="card-body">
                            <h3 contenteditable="true">Titolo Card</h3>
                            <p contenteditable="true">Descrizione breve della card. Modifica questo testo come preferisci.</p>
                        </div>
                    </div>`,

                'block-pricing': `
                    <div class="wb-pricing">
                        <div class="pricing-title" contenteditable="true">Piano Pro</div>
                        <div class="pricing-price" contenteditable="true">29<span>/mese</span></div>
                        <ul class="pricing-features">
                            <li contenteditable="true">Funzionalita completa</li>
                            <li contenteditable="true">Supporto prioritario</li>
                            <li contenteditable="true">Aggiornamenti gratuiti</li>
                            <li contenteditable="true">10 GB di spazio</li>
                        </ul>
                            <button class="wb-button" contenteditable="true">Scegli piano</button>
                        </div>`,
                        'block-testimonial': `
                        <div class="wb-testimonial">
                            <div class="testimonial-quote" contenteditable="true">"Questo prodotto ha cambiato completamente il mio modo di lavorare. Lo consiglio a tutti."</div>
                            <div class="testimonial-author">
                                <div class="testimonial-avatar"></div>
                                <div>
                                    <div class="testimonial-name" contenteditable="true">Mario Rossi</div>
                                    <div class="testimonial-role" contenteditable="true">CEO, Azienda</div>
                                </div>
                            </div>
                        </div>`,
                        'block-login': `
                            <form class="wb-form" data-auth-login style="max-width:420px;margin:0 auto;">
                                <h3 style="margin-bottom:16px;font-size:22px;color:#333;text-align:center;">Accedi</h3>
                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Email</label>
                                    <input type="email" name="email" class="wb-input" placeholder="la-tua@email.com" required>
                                </div>
                                <div style="margin-bottom:16px;">
                                    <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Password</label>
                                    <input type="password" name="password" class="wb-input" placeholder="La tua password" required>
                                </div>
                                <button type="submit" class="wb-button" style="width:100%;cursor:pointer;">Accedi</button>
                            </form>`,
                        'block-register': `
                            <form class="wb-form" data-auth-register style="max-width:420px;margin:0 auto;">
                                <h3 style="margin-bottom:16px;font-size:22px;color:#333;text-align:center;">Registrati</h3>
                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Email</label>
                                    <input type="email" name="email" class="wb-input" placeholder="la-tua@email.com" required>
                                </div>
                                <div style="margin-bottom:16px;">
                                    <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Password</label>
                                    <input type="password" name="password" class="wb-input" placeholder="Crea una password" required>
                                </div>
                                <button type="submit" class="wb-button" style="width:100%;cursor:pointer;">Crea account</button>
                            </form>`,
                        'block-logout': `
                            <div style="text-align:center;">
                                <button type="button" class="wb-button" data-auth-logout style="cursor:pointer;">Logout</button>
                            </div>`,
                        'block-protected': `
                            <div class="wb-protected-gate" data-wb-protected data-wb-require-role="user">
                                <div class="wb-protected-lock">
                                    <i class="fa-solid fa-lock"></i>
                                    <h3>Contenuto Riservato</h3>
                                    <p>Devi fare login per vedere questo contenuto</p>
                                    <button class="wb-button" style="margin-top:8px;font-size:13px;padding:8px 20px;">Accedi</button>
                                </div>
                                <div class="wb-protected-content">
                                    <p style="color:#aaa;text-align:center;font-size:12px;padding:10px;">
                                        <i class="fa-solid fa-info-circle"></i> Trascina elementi qui dentro - saranno visibili solo agli utenti autorizzati.
                                    </p>
                                </div>
                            </div>`,
                        'block-role-gate': `
                            <div class="wb-role-gate" data-wb-role-show="admin">
                                <i class="fa-solid fa-shield-halved"></i>
                                <div class="wb-role-gate-label">Visibile solo a: Admin</div>
                                <div class="wb-role-gate-sub">Trascina elementi qui. Gli utenti con ruolo inferiore non vedranno questo blocco.</div>
                            </div>`,
                        'block-user-profile': `
                            <div class="wb-user-profile" data-wb-user-profile>
                                <div class="wb-profile-avatar">
                                    <span data-wb-avatar-letter>U</span>
                                </div>
                                <div class="wb-profile-info">
                                    <div class="wb-profile-name" data-wb-username>Mario Rossi</div>
                                    <div class="wb-profile-email" data-wb-useremail>mario@esempio.com</div>
                                    <span class="wb-profile-role" data-wb-userrole>user</span>
                                    <div class="wb-profile-bio" data-wb-userbio>La tua bio apparirà qui...</div>
                                    <button class="wb-profile-edit-btn" data-wb-profile-edit>
                                        <i class="fa-solid fa-pen"></i> Modifica profilo
                                    </button>
                                </div>
                            </div>`,
                        'block-progress': `
                            <div class="wb-progress-tracker" data-wb-progress="my-progress" data-wb-progress-max="100" data-wb-progress-unit="%">
                                <div class="wb-progress-header">
                                    <div class="wb-progress-label">Il tuo progresso</div>
                                    <div class="wb-progress-value">0%</div>
                                </div>
                                <div class="wb-progress-bar">
                                    <div class="wb-progress-fill" style="width:0%;"></div>
                                </div>
                                <div class="wb-progress-actions">
                                    <button class="wb-button" data-wb-progress-add="10" style="font-size:12px;padding:6px 14px;">+10</button>
                                    <button class="wb-button" data-wb-progress-reset style="font-size:12px;padding:6px; 14px;background:#e63946;">Reset</button>
                                </div>
                            </div>`,
                        'block-blog-list': `
                            <div class="wb-blog-list" data-wb-blog-list data-wb-blog-limit="10">
                                <div class="wb-blog-placeholder">
                                    <i class="fa-solid fa-newspaper"></i>
                                    <p>I post del blog appariranno qui</p>
                                    <small style="font-size:12px;">Gli utenti potranno pubblicare e leggere post</small>
                                </div>
                            </div>`,
                        'block-blog-editor': `
                            <div class="wb-blog-editor" data-wb-blog-editor>
                                <h3> Scrivi un post</h3>
                                <input type="text" class="wb-input" placeholder="Titolo del post..." data-wb-blog-title style="margin-bottom:10px;">
                                <textarea class="wb-textarea-el" placeholder="Scrivi il tuo contenuto qui..." data-wb-blog-content rows="5" style="margin-bottom:10px;"></textarea>
                                <div class="wb-blog-editor-actions">
                                    <button class="wb-button" data-wb-blog-publish> Pubblica</button>
                                    <button class="wb-button" data-wb-blog-draft style="background:#666;"> Bozza</button>
                                </div>
                            </div>`,
                        'block-user-data': `
                            <div class="wb-user-data-widget" data-wb-userdata="my-data">
                                <div class="wb-user-data-label">Il tuo dato</div>
                                <div class="wb-user-data-value" data-wb-data-value>-</div>
                                <input type="text" class="wb-input" placeholder="Inserisci il valore..." data-wb-data-input style="margin-top:8px;">
                                <button class="wb-button" data-wb-data-save style="margin-top:8px;font-size:12px;padding:7px 16px;"> Salva</button>
                            </div>`,
                        'block-leaderboard': `
                            <div class="wb-leaderboard" data-wb-leaderboard="my-progress" data-wb-leaderboard-limit="10">
                                <div class="wb-leaderboard-title"> Classifica</div>
                                <div class="wb-leaderboard-body">
                                    <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0;">
                                        <span style="font-size:18px;min-width:30px;">1: </span>
                                        <span style="flex:1;font-weight:600;color:#333;">Mario Rossi</span>
                                        <span style="font-weight:800;color:#4361ee;">95</span>
                                    </div>
                                    <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0;">
                                        <span style="font-size:18px;min-width:30px;">2: </span>
                                        <span style="flex:1;font-weight:600;color:#333;">Anna Bianchi</span>
                                        <span style="font-weight:800;color:#4361ee;">87</span>
                                    </div>
                                </div>
                            </div>`,
                        'block-admin': `
                            <div class="wb-admin-panel" data-wb-role-show="admin">
                                <div class="wb-admin-title">
                                    <i class="fa-solid fa-user-shield"></i> Pannello Amministrazione
                                </div>
                                <div class="wb-admin-tabs">
                                    <button class="wb-admin-tab active" data-wb-admin-tab="users"> Utenti</button>
                                    <button class="wb-admin-tab" data-wb-admin-tab="posts"> Post</button>
                                    <button class="wb-admin-tab" data-wb-admin-tab="stats"> Statistiche</button>
                                </div>
                                <div data-wb-admin-content="users" style="color:#999;text-align:center;padding:20px;font-size:13px;">
                                    <i class="fa-solid fa-users" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>
                                    Lista utenti caricata in tempo (solo nel sito esportato)
                                </div>
                                <div data-wb-admin-content="posts" style="display:none;color:#999;text-align:center;padding:20px;font-size:13px;">
                                    <i class="fa-solid fa-newspaper" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>
                                    Lista post caricata in tempo reale
                                </div>
                                <div data-wb-admin-content="stats" style="display:none;color:#999;text-align:center;padding:20px;font-size:13px;">
                                    <i class="fa-solid fa-chart-bar" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>
                                    Statistiche caricate in tempo reale
                                </div>
                            </div>`,
                        'block-product-list': `
                            <div class="wb-product-list" data-wb-product-list data-wb-product-limit="12" data-wb-currency"€">
                                <div class="wb-product-placeholder">
                                    <i class="fa-solid fa-store"></i>
                                    <p>I prodotti appariranno qui</p>
                                    <small style="font-size:12px;">Aggiungi prodotti da Supabase -> wb_products</small>
                                </div>
                            </div>`,
                        'block-product-card': `
                            <div class="wb-product-card-static" data-wb-product-static>
                                <div class="wb-produc-img-wrap">
                                    <i class="fa-solid fa-box-open"></i>
                                </div>
                                <div class="wb-produc-info">
                                    <div class="wb-product-category">Categoria</div>
                                    <div class="wb-product-name" conenteditable="true">Nome Prodotto</div>
                                    <div class="wb-product-desc" contenteditable="true">Descrizione breve del prodotto. Modifica questo testo.</div>
                                    <div class="wb-product-price" contenteditable="true">€29.99</div>
                                    <button class="wb-add-to-cart-btn" data-wb-static-cart> Aggiungi al carrello</button>
                                </div>
                            </div>`,
                        'block-cart': ` 
                            <div class="wb-cart-widget" data-wb-cart data-wb-currency="€">
                                <div class="wb-cart-title">
                                    Carrello
                                    <span class="wb-cart-count" data-wb-cart-count>0</span>
                                </div>
                                <div data-wb-cart-body>
                                    <div class="wb-cart-empty">Il carrello è vuoto</div>
                                </div>
                                <div class="wb-cart-total-row">
                                    <span>Totale</span>
                                    <span data-wb-cart-total>€0.00</span>
                                </div>
                                <button class="wb-button" data-wb-checkout style="width:100%;margin-top:12px;cursor:pointer;">
                                    Procedi al pagamento ->
                                </button>
                            </div>`,
                        'block-booking-form': `
                            <form class="wb-booking-form" data-wb-booking-form data-success-msg=" Prenotazione Confermata! Ti contateremo presto.">
                                <h3> Prenota un appuntamento</h3>
                                <div class="wb-booking-row">
                                    <input type="text" name="name" class="wb-input" placeholder="Il tuo nome *" required>
                                    <input type="email" name="email" class="wb-input" placeholder="Email *" required>
                                </div>
                                <div style="margin-boottom:12px;">
                                    <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Servizio *</label>
                                    <select name="service" class="wb-select" required>
                                        <option value="">Seleziona un servizio...</option>
                                        <option>Consulenza</option>
                                        <option>Appuntamento</option>
                                    </select>
                                </div>
                                <div class="wb-booking-row">
                                    <div>
                                        <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Data *</label>
                                        <input type="date" name="date" class="wb-input" required>
                                    </div>
                                    <div>
                                        <label style="display:block;font-size:13px;color:#555;margin-bottom:4px;">Orario *</label>
                                        <select name="time" class="wb-select" required>
                                            <option value="">Seleziona...</option>
                                            <option>09.00</option>
                                            <option>10.00</option>
                                            <option>11:00</option>
                                            <option>14:00</option>
                                            <option>15:00</option>
                                            <option>16:00</option>
                                        </select>
                                    </div>
                                </div>
                                <div style="margin-bottom:16px;">
                                    <label style="display:block;font-size:13px:color:#555;margin-bottom:4px;">Note (opzionale)</label>
                                    <textarea name="notes" class="wb-textarea-el" placeholder="Informazioni aggiuntive..." rows="3"></textarea>
                                </div>
                                <button type="submit" class="wb-button" style="width:100%; cursor:pointer;"> Prenota ora</button>
                            </form>`,
                        'block-booking-admin': `
                            <div class="wb-booking-admin" data-wb-booking-admin data-wb-role-show="admin">
                                <h3> Gestione Prenotazioni</h3>
                                <div data-wb-booking-table style="color:#999;text-align:center;padding:20px;font-size:13px;">
                                    <i class="fa-solid fa-calendar-days" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>
                                    Le prenotazioni vengono caricate nel sito esportato (solo admin)
                                </div>
                            </div>`,
                        'block-payment': `
                            <div class="wb-payment-widget" data-wb-payment data-wb-amount="29.99" data-wb-currency="€" data-wb-stripe-price="">
                                <div class="wb-payment-product" contenteditable="true">Piano Premium</div>
                                <div class="wb-payment-desc" contenteditable="true">Accesso completo per 1 mese</div>
                                <div class="wb-payment-amount">€29.99</div>
                                <hr class="wb-payment-divider">
                                <div style="display:flex;flex-direcion:column;gap:10px;align-items:center;">
                                    <button class="wb-stripe-btn" data-wb-stripe>
                                        <i class="fa-brands fa-stripe-s"></i> Paga con Stripe
                                    </button>
                                    <div data-wb-paypal-container style="width:100%;">
                                        <button class="wb-paypal-bn" data-wb-paypal-static>
                                            <i class="fa-brands fa-paypal"></i> Paga con PayPal
                                        </button>
                                    </div>
                                </div>
                                <div style="font-size:11px;color:#999;margin-top:12px;">
                                    Pagamento sicuro - SSL crittografato
                                </div>
                            </div>`,
                        'block-stripe-btn': `
                            <div style="tex-align:center;">
                                <button class="wb-stripe-btn" data-wb-stripe style="display:inline-flex;width:auto;">
                                    <i class="fa-brands fa-stripe-s"></i> Paga con Stripe
                                </button>
                            </div>`,
                        'block-paypal-btn': `
                            <div style="text-align:center;" data-wb-paypal-container>
                                <button class="wb-paypal-btn" data-wb-paypal-static style="display:inline-flex;width:auto;">
                                    <i class="fa-brands fa-paypal"></i> Paga con PayPal
                                </button>
                            </div>`,
                        'block-newsletter': `
                            <div class="wb-newsletter" data-wb-newsletter data-success-msg=" Iscritto! Grazie per esserti unito.">
                                <h3 contenteditable="true"> Rimani aggiornato</h3>
                                <p contenteditable="true">Iscriviti alla nostra newsletter e ricevi le ultime novità direttamente nella tua casella.</p>
                                <div class="wb-newsletter-form">
                                    <input type="email" data-wb-newsletter-email placeholder="La tua email..." class="wb-newsletter-input">
                                    <button data-wb-newsletter-btn>Iscriviti</button>
                                </div>
                                <div class="wb-newsletter-small">Nessuno spam. Puoi disiscriverti in qualsiasi momento.</div>
                            </div>`
                        };
    return templates[type] || '<div>Elemento</div>';
}


function setupElementEvents(element) {
    if (element._eventsBound) return;
    element._eventsBound = true;
    element.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.selectedElement === element) {
            setTimeout(() => {
                if (state.selectedElement === element) {
                    deselectElement();
                }
            }, 10);
        } else {
            selectElement(element);
        }
    });

    element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const editable = element.querySelector('[contenteditable]');
        if (editable) {
            editable.focus();
        }
    });
    element.addEventListener('dragstart', (e) => {
        if (currentMode === 'free') { e.preventDefault(); return; }
        if (element.dataset.type === 'background') {
            e.preventDefault();
            return;
        } 
        if (e.target === element) {
            state.draggedElement = element;
            state.draggedType= null;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                element.style.opacity = '0.4';
            }, 0);
        }
    });

    element.addEventListener('dragend', (e) => {
        element.style.opacity = '1';
        state.draggedElement = null;
        removeAllDropIndicators();
    });
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectElement(element);
        showContextMenu(e.pageX, e.pageY);
    });
    element.querySelectorAll('.element-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            handleElementAction(action, element);
        });
    });
    element.querySelectorAll('[contenteditable]').forEach(editable => {
        editable.addEventListener('input', () => {
            clearTimeout(editable._saveTimeout);
            editable._saveTimeout = setTimeout(() => {
                saveHistory();
                updatePropertyPanel();
            }, 500);
        });
        editable.addEventListener('focus', (e) => {
            e.stopPropagation();
        });
    });
    element.querySelectorAll('.wb-column.builder-element').forEach(col => {
        setupElementEvents(col);
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            col.classList.remove('drag-over');

            let newEl;
            if (state.draggedType) {
                newEl = createElement(state.draggedType);
            } else if (state.draggedElement) {
                newEl = state.draggedElement;
            }
            if (newEl) {
                if (newEl.contains(col)) return;
                col.appendChild(newEl);
                finalizeDrop(newEl);
            }
        });
    });
}

function selectElement(element) {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('selected');
        if (state.selectedElement.dataset.startHidden === 'true') {
            state.selectedElement.style.opacity = '0.3';
        }
    }
    state.selectedElement = element;
    element.classList.add('selected');
    if (element.dataset.startHidden === 'true') {
        element.style.opacity = '0.7';
     //   element.style.visibility = 'visible';
    }

    panelEmpty.style.display = 'none';
    propertiesContent.style.display = 'block';
    updatePropertyPanel();
    updateLayers();
    if (currentMode === 'free') {
        updateFreeToolbarValues(element);
    }
}

function deselectElement() {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('selected');
        if (state.selectedElement.dataset.startHidden === 'true') {
            state.selectedElement.style.opacity = '0.3';
        }
    }
    //if (state.selectedElement && state.selectedElement.dataset.startHidden === 'true') {
      //  state.selectedElement.style.opacity = '0';
        //state.selectedElement.style.visibility = 'hidden';
    //}
    state.selectedElement = null;
    panelEmpty.style.display = 'flex';
    propertiesContent.style.display = 'none';
    $$('.prop-tab').forEach(tab => tab.classList.remove('active'));
    $$('.prop-panel').forEach(panel => panel.classList.remove('active'));
    const firstTab = $('.prop-tab[data-tab="content"]');
    const firstPanel = $('#tab-content');
    if (firstTab) firstTab.classList.add('active');
    if (firstPanel) firstPanel.classList.add('active');
}

canvas.addEventListener('mouseover', (e) => {
    const el = e.target.closest('.builder-element');
    if (!el) return;
    const target = getStyleTarget(el);
    const hoverAnim = el.dataset.hoverAnimation;
    if (hoverAnim && hoverAnim !== 'none' && hoverAnim !== 'hover-grow' && hoverAnim !== 'hover-shrink') {
        target.classList.remove('animate__animated', 'animate__' + hoverAnim);
        void target.offsetWidth;
        target.style.setProperty('animation-duration', (el.dataset.animSpeed || '0.8') + 's', 'important');
        target.style.animationFillMode = 'both';
        target.classList.add('animate__animated', 'animate__' + hoverAnim);
    }
}, true);
canvas.addEventListener('mouseleave', (e) => {
    const el = e.target.closest('.builder-element');
    if (!el) return;
    const target = getStyleTarget(el);
    const hoverAnim = el.dataset.hoverAnimation;
    if (hoverAnim && hoverAnim !== 'none' && hoverAnim !== 'hover-grow' && hoverAnim !== 'hover-shrink') {
        target.classList.remove('animate__animated', 'animate__' + hoverAnim);
    }
}, true);

canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target.closest('.canvas-empty')) {
        deselectElement();
    }
});

function handleElementAction(action, element) {
    switch (action) {
        case 'delete':
            deleteElement(element);
            break;
        case 'duplicate':
            duplicateElement(element);
            break;
        case 'moveup':
            moveElement(element, 'up');
            break;
        case 'movedown':
            moveElement(element, 'down');
            break;
        case 'copy':
            copyElement(element);
            break;
        case 'paste':
            pasteElement();
            break;
    }
}

function deleteElement(element) {
    if (!element) return;
    const shouldDeselect =
        state.selectedElement === element ||
        element.contains(state.selectedElement);
    element.remove();
    if (shouldDeselect) {
        deselectElement();
    }
    showCanvasEmpty();
    saveHistory();
    updateLayers();
}

function duplicateElement(element) {
    if (!element) return;
    const clone = element.cloneNode(true);
    state.elementCounter++;
    clone.dataset.id = 'el-' +state.elementCounter;
    element.parentNode.insertBefore(clone, element.nextSibling);
    setupElementEvents(clone);
    clone.querySelectorAll('.builder-element').forEach(child => setupElementEvents(child));
    if (currentMode === 'free') {
        addResizeHandles(clone);
        addFreeDrag(clone);
    }
    selectElement(clone);
    saveHistory();
    updateLayers();
}

function moveElement(element, direction) {
    if (!element) return;
    const parent = element.parentNode;
    if (direction === 'up') {
        const prev = element.previousElementSibling;
        if (prev && !prev.classList.contains('drop-indicator') && prev !== canvasEmpty) {
            parent.insertBefore(element, prev); 
        }
    } else {
        let next = element.nextElementSibling;
        while (next && (next.classList.contains('drop-indicator') || next.classList.contains('resize-handle'))) {
            next = next.nextElementSibling;
        }
        if (next) {
            parent.insertBefore(next, element);
        }
    }

    saveHistory();
    updateLayers();
}

function copyElement(element) {
    if (!element) return;
    state.clipboard = element.cloneNode(true);
}

function pasteElement() {
    if (!state.clipboard) return;
    const clone = state.clipboard.cloneNode(true);
    state.elementCounter++;
    clone.dataset.id = 'el-' + state.elementCounter;
    setupElementEvents(clone);
    clone.querySelectorAll('.builder-element').forEach(child => setupElementEvents(child));

    if (currentMode === 'free') {
        addResizeHandles(clone);
        addFreeDrag(clone);
    }
    if (state.selectedElement && isContainer(state.selectedElement)) {
        const container = state.selectedElement.querySelector('.wb-section, .wb-container, .wb-form') || state.selectedElement;
        container.appendChild(clone);
    } else if (state.selectedElement) {
        state.selectedElement.parentNode.insertBefore(clone, state.selectedElement.nextSibling);
    } else {
        canvas.appendChild(clone);
    }

    hideCanvasEmpty();
    selectElement(clone);
    saveHistory();
    updateLayers();
}

function initPropertyTabs() {
    $$('.prop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.prop-tab').forEach(t => t.classList.remove('active'));
            $$('.prop-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = $('#tab-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');
        });
    });
}

function initPropertyInputs() {
    const propText = $('#propText');
    propText.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const editable = getEditableContent(state.selectedElement);
        if (editable) {
            editable.textContent = propText.value;
            saveHistory();
        }
    });

    const propLink = $('#propLink');
    propLink.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const link = state.selectedElement.querySelector('a') || state.selectedElement.querySelector('.wb-link');
        if (link) {
            link.href = propLink.value;
            saveHistory();
        }
    });

    const propImageSrc = $('#propImageSrc');
    propImageSrc.addEventListener('change', applyImageSrc);
    propImageSrc.addEventListener('input', applyImageSrc);
    function applyImageSrc() {
        if (!state.selectedElement) return;
        const imgContainer = state.selectedElement.querySelector('.wb-image');
        if (imgContainer) {
            const placeholder = imgContainer.querySelector('.wb-image-placeholder');
            let img = imgContainer.querySelector('img');
            if (propImageSrc.value) {
                if (placeholder) placeholder.style.display = 'none';
                if (!img) {
                    img = document.createElement('img');
                    imgContainer.appendChild(img);
                }
                img.src = propImageSrc.value;
                img.alt = $('#propAlt').value || '';
            }
            saveHistory();
        }
    }

    $('#btnUploadImage').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                propImageSrc.value = ev.target.result;
                propImageSrc.dispatchEvent(new Event('change'));
            };
            reader.readAsDataURL(file);
        });
        fileInput.click();
    });

    $('#propAlt').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const img = state.selectedElement.querySelector('img');
        if (img) {
            img.alt = $('#propAlt').value;
            saveHistory();
        }
    });
    const propBgImage = $('#propBgImage');
    if (propBgImage) {
        propBgImage.addEventListener('input', applyBgImage);
        propBgImage.addEventListener('change', applyBgImage);
    }
    function applyBgImage() {
        if (!state.selectedElement) return;
        if (state.selectedElement.dataset.type !== 'background') return;
        const bgChild = state.selectedElement.querySelector('.wb-background');
        if (!bgChild) return;
        const url = propBgImage.value;
        if (url) {
            bgChild.style.backgroundImage = `url('${url}')`;
            bgChild.style.backgroundSize = $('#propBgSize').value || 'cover';
            bgChild.style.backgroundRepeat = $('#propBgRepeat').value || 'no-repeat';
            bgChild.style.backgroundPosition = 'center';
        } else {
            bgChild.style.backgroundImage = '';
        }
        saveHistory();
    }
    const btnUploadBgImage = $('#btnUploadBgImage');
    if (btnUploadBgImage) {
        btnUploadBgImage.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    propBgImage.value = ev.target.result;
                    applyBgImage();
                };
                reader.readAsDataURL(file);
            });
            fileInput.click();
        });
    }
    const propBgSize = $('#propBgSize');
    if (propBgSize) {
        propBgSize.addEventListener('change', applyBgImage);
    }
    const propBgRepeat = $('#propBgRepeat');
    if (propBgRepeat) {
        propBgRepeat.addEventListener('change', applyBgImage);
    }

    $('#propFont').addEventListener('change', () => applyStyle('fontFamily', $('#propFont').value));

    $('#propFontSize').addEventListener('input', () => {
        const val = $('#propFontSize').value;
        if (val) applyStyle('fontSize', val + 'px');
    });

    $('#propFontWeight').addEventListener('change', () => applyStyle('fontWeight', $('#propFontWeight').value));
    $$('.prop-btn-icon[data-align]').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.prop-btn-icon[data-align]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyStyle('textAlign', btn.dataset.align);
        });
    });

    $('#propColor').addEventListener('input', () => {
        $('#propColorText').value = $('#propColor').value;
        applyStyle('color', $('#propColor').value);
    });

    $('#propColorText').addEventListener('change', ()=>  {
        $('#propColor').value = $('#propColorText').value;
        applyStyle('color', $('#propColorText').value);
    });

    $('#propBgColor').addEventListener('input', () => {
        $('#propBgColorText').value = $('#propBgColor').value;
        applyStyle('backgroundColor', $('#propBgColor').value);
    });

    $('#propBgColorText').addEventListener('change', () => {
        $('#propBgColor').value = $('#propBgColorText').value;
        applyStyle('backgroundColor', $('#propBgColorText').value);
    });

    $('#propLineHeight').addEventListener('input', () => {
        const val = $('#propLineHeight').value;
        if (val) applyStyle('lineHeight', val);
    });

    $('#propLetterSpacing').addEventListener('input', () => {
        const val= $('#propLetterSpacing').value;
        if (val) applyStyle('letterSpacing', val + 'px');
    });

    $('#propWidth').addEventListener('change', () => applyStyle('width', parseSizeValue($('#propWidth').value)));
    $('#propHeight').addEventListener('change', () => applyStyle('height', parseSizeValue($('#propHeight').value)));

    ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
        $(`#propMargin${side}`).addEventListener('input', () => {
            const val = $(`#propMargin${side}`).value;
            applyStyle(`margin${side}`, val ? val + 'px' : '');
        });
    });

    ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
        $(`#propPadding${side}`).addEventListener('input', () => {
            const val = $(`#propPadding${side}`).value;
            applyStyle(`padding${side}`, val ? val + 'px' : '');
        });
    });

    $('#propBorderWidth').addEventListener('input', () => updateBorder());
    $('#propBorderStyle').addEventListener('change', () => updateBorder());
    $('#propBorderColor').addEventListener('input', () => {
        $('#propBorderColorText').value = $('#propBorderColor').value;
        updateBorder();
    });
    $('#propBorderColorText').addEventListener('change', () => {
        $('#propBorderColor').value = $('#propBorderColorText').value;
        updateBorder();
    });

    $('#propBorderRadius').addEventListener('input', () => {
        const val = $('#propBorderRadius').value;
        applyStyle('borderRadius', val ? val + 'px' : '');
    });

    $('#propShadow').addEventListener('change', () => applyStyle('boxShadow', $('#propShadow').value));
    $('#propOpacity').addEventListener('input', () => {
        const val = $('#propOpacity').value;
        $('#opacityValue').textContent = val + '%';
        applyStyle('opacity', val / 100);
    });

    $('#propDisplay').addEventListener('change', () => {
        const val = $('#propDisplay').value;
        applyStyle('display', val);

        const flexOpts = $('#flexOptions');
        flexOpts.style.display = val === 'flex' ? 'block' : 'none';
    });

    $('#propFlexDirection').addEventListener('change', () => applyStyle('flexDirection', $('#propFlexDirection').value));
    $('#propAlignItems').addEventListener('change', () => applyStyle('alignItems', $('#propAlignItems').value));
    $('#propJustifyContent').addEventListener('change', () => applyStyle('justifyContent', $('#propJustifyContent').value));
    $('#propGap').addEventListener('input', () => {
        const val = $('#propGap').value;
        applyStyle('gap', val ? val + 'px' : '');
    });

    $('#propPosition').addEventListener('change', () => applyStyle('position', $('#propPosition').value));
    $('#propOverflow').addEventListener('change', () => applyStyle('overflow', $('#propOverflow').value));
    $('#propId').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const newId = $('#propId').value;
        state.selectedElement.id = newId;
        state.selectedElement.dataset.elementId = newId;
        const target = getStyleTarget(state.selectedElement);
        if (target !== state.selectedElement) target.removeAttribute('id');
        saveHistory();
    });

    $('#propClasses').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        const sysClasses = Array.from(target.classList).filter(c => c.startsWith('wb-') || c === 'builder-element' || c=== 'selected' );
        const userClasses = $('#propClasses').value.split(' ').filter(c => c.trim());
        target.className = [...sysClasses, ...userClasses].join(' ');
        saveHistory();
    });

    $('#propCustomCSS').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        const css = $('#propCustomCSS').value;
        css.split(';').forEach(rule => {
            const parts = rule.split(':');
            if (parts.length === 2) {
                const prop = parts[0].trim();
                const val = parts[1].trim();
                if (prop && val) {
                    const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    target.style[camelProp] = val;
                }
            }
        });
        saveHistory();
    });

    $('#btnDeleteElement').addEventListener('click', () => {
        if (state.selectedElement) deleteElement(state.selectedElement);
    });

    $('#btnDuplicateElement').addEventListener('click', () => {
        if (state.selectedElement) duplicateElement(state.selectedElement);
    });
    $('#propAnimation').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const anim = $('#propAnimation').value;
        const target = getStyleTarget(state.selectedElement);
        target.className = target.className.replace(/\banimate__\S+/g, '').trim();
        state.selectedElement.dataset.animation = anim;
        if (anim !== 'none') {
            const speed = ($('#propAnimSpeed').value || '1') + 's';
            target.style.animationDuration = speed;
            target.style.animationFillMode = 'both';
            state.selectedElement.dataset.animation  = anim;
            target.classList.remove('animate__animated', 'animate__' + anim);
            target.dataset.pending = anim;
            observeAnimation(target, anim, speed);
        } else {
            target.style.animationDuration = '';
            target.style.animationFillMode = '';
        }
        saveHistory();
    });
    $('#propHoverAnimation').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const hoverAnim = $('#propHoverAnimation').value;
        const target = getStyleTarget(state.selectedElement);
        target.classList.remove('hover-grow', 'hover-shrink');
        target.removeAttribute('data-hover-anim');
        state.selectedElement.dataset.hoverAnimation = hoverAnim;
        if (hoverAnim === 'hover-grow' || hoverAnim === 'hover-shrink') {
            target.classList.add(hoverAnim);
        } else if (hoverAnim !== 'none') {
            target.dataset.hoverAnim = hoverAnim;
        }
        saveHistory();
    });
    $('#propAnimSpeed').addEventListener('input', () => {
        const speed = $('#propAnimSpeed').value;
        $('#animSpeedValue').textContent = speed + 's';
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        target.style.setProperty('animation-duration', speed + 's', 'important');
        state.selectedElement.dataset.animSpeed = speed;
        saveHistory();
    });
    $('#btnTestAnimation').addEventListener('click', () => {
        if (!state.selectedElement) return;
        const anim = $('#propAnimation').value;
        if (anim === 'none') return;
        const target = getStyleTarget(state.selectedElement);
        target.classList.remove('animate__animated', 'animate__' + anim);
        void target.offsetWidth;
        const speed = ($('#propAnimSpeed').value || '1') + 's';
        target.style.setProperty('animation-duration', speed, 'important');
        target.style.animationFillMode = 'both';
        target.classList.add('animate__animated', 'animate__' + anim);
    });
    $('#btnLayerUp').addEventListener('click', () => {
        if (!state.selectedElement) return;
        const el = state.selectedElement;
        let next = el.nextElementSibling;
        while (next && !next.classList.contains('builder-element')) {
            next = next.nextElementSibling;
        }
        if (next && next.classList.contains('builder-element')) {
            el.parentNode.insertBefore(next, el);
            saveHistory();
            updateLayers();
        }
    });
    $('#btnLayerDown').addEventListener('click', () => {
        if (!state.selectedElement) return;
        const el = state.selectedElement;
        let prev = el.previousElementSibling;
        while (prev && !prev.classList.contains('builder-element')) {
            prev = prev.previousElementSibling;
        }
        if (prev && prev.classList.contains('builder-element')) {
            el.parentNode.insertBefore(el, prev);
            saveHistory();
            updateLayers();
        }
    });



    $('#propSelectOptions').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const select = state.selectedElement.querySelector('.wb-select');
        if (!select) return;
        const lines = $('#propSelectOptions').value.split('\n').filter(l => l.trim());
        select.replaceChildren(...lines.map(line => {
            const option = document.createElement('option');
            option.textContent = line.trim();
            return option;
        }));
        saveHistory();
    });
    $('#propSelectOptionActions').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const select = state.selectedElement.querySelector('.wb-select');
        if (!select) return;
        const actions= parseOptionActionsText($('#propSelectOptionActions').value);
        state.selectedElement.dataset.optionActions = JSON.stringify(actions);
        saveHistory();
    });
    $('#addActionBtn').addEventListener('click', () => {
        if (!state.selectedElement) return;
        let actions = [];
        try { actions = JSON.parse(state.selectedElement.dataset.actions || '[]'); } catch(e) {}
        actions.push({ type: 'none', value: '', newTab: false });
        state.selectedElement.dataset.actions = JSON.stringify(actions);
        renderActionsPanel(actions);
        saveHistory();
    });

    $('#propStartHidden').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const el = state.selectedElement;
        if ($('#propStartHidden').checked) {
            el.dataset.startHidden = 'true';
            el.style.opacity = '0.3';
            el.style.outline = '';
            el.style.visibility = '';
            el.style.pointerEvents = '';
        } else {
            el.dataset.startHidden = 'false';
            el.style.opacity = '';
            el.style.visibility = '';
            el.style.pointerEvents = '';
            el.style.outline = '';
        }
        saveHistory();
    });

    $('#propClickAnim').addEventListener('change', () => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.clickAnim = $('#propClickAnim').checked ? 'true' : 'false';
        saveHistory();
    });

    $('#propActionNewTab').addEventListener('change', () => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.actionNewTab = $('#propActionNewTab').checked ? 'true' : 'false';
        saveHistory();
    });
    $('#propRequireRole')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const gate = state.selectedElement.querySelector('[data-wb-protected]');
        if (gate) gate.dataset.wbRequireRole = $('#propRequireRole').value;
        saveHistory();
    });
    $('#propProtectedTitle')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const h3 = state.selectedElement.querySelector('.wb-protected-lock h3');
        if (h3) h3.textContent = $('#propProtectedTitle').value;
        saveHistory();
    });
    $('#propProtectedMsg')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const p = state.selectedElement.querySelector('.wb-protected-lock p');
        if (p) p.textContent = $('#propProtectedMsg').value;
        saveHistory();
    });
    $('#propProtectedRedirect')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.loginRedirect = $('#propProtectedRedirect').value;
        saveHistory();
    });
    $('#propRoleGateRole')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const rg = state.selectedElement.querySelector('[data-wb-role-show]');
        if (rg) {
            rg.dataset.wbRoleShow = $('#propRoleGateRole').value;
            const lbl = state.selectedElement.querySelector('.wb-role-gate-label');
            if (lbl) lbl.textContent = 'Visibile solo a: ' + $('#propRoleGateRole').value;
        }
        saveHistory();
    });
    ['propProgressKey','propProgressLabel','propProgressUnit','propProgressMax','propProgressIncrement'].forEach(id => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.addEventListener('input', () => {
            if (!state.selectedElement) return;
            const tr = state.selectedElement.querySelector('[data-wb-progress]');
            if (!tr) return;
            if (id === 'propProgressKey') tr.dataset.wbProgress = inp.value;
            if (id === 'propProgressUnit') { tr.dataset.wbProgressUnit = inp.value; const v = state.selectedElement.querySelector('.wb-progress-value'); if (v) v.textContent = '0' + inp.value; }
            if (id === 'propProgressMax') tr.dataset.wbProgressMax = inp.value;
            if (id === 'propProgressLabel') { const l = state.selectedElement.querySelector('.wb-progress-label'); if (l) l.textContent = inp.value; }
            if (id === 'propProgressIncrement') { const b = state.selectedElement.querySelector('[data-wb-progress-add]'); if (b) { b.dataset.wbProgressAdd = inp.value; b.textContent = '+' + inp.value; } }
            saveHistory();
        });
    });
    $('#propBlogLimit')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const bl = state.selectedElement.querySelector('[data-wb-blog-list]');
        if (bl) bl.dataset.wbBlogLimit = $('#propBlogLimit').value;
        saveHistory();
    });
    $('#propBlogCategory')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const bl = state.selectedElement.querySelector('[data-wb-blog-list]');
        if (bl) bl.dataset.wbBlogCategory = $('#propBlogCategory').value;
        saveHistory();
    });
    $('#propUserDataKey')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const wd = state.selectedElement.querySelector('[data-wb-userdata]');
        if (wd) wd.dataset.wbUserdata = $('#propUserDataKey').value;
        saveHistory();
    });
    $('#propUserDataLabel')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const lbl= state.selectedElement.querySelector('.wb-user-data-label');
        if (lbl) lbl.textContent = $('#propUserDataLabel').value;
        saveHistory();
    });
    $('#propLeaderboardKey')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const lb = state.selectedElement.querySelector('[data-wb-leaderboard]');
        if (lb) lb.dataset.wbLeaderboard = $('#propLeaderboardKey').value;
        saveHistory();
    });
    $('#propLeaderboardTitle')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const t = state.selectedElement.querySelector('.wb-leaderboard-title');
        if (t) t.textContent = $('#propLeaderboardTitle').value;
        saveHistory();
    });
    $('#propLeaderboardLimit')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const lb = state.selectedElement.querySelector('[data-wb-leaderboard]');
        if (lb) lb.dataset.wbLeaderboardLimit = $('#propLeaderboardLimit').value;
        saveHistory();
    });
    $('#propProductLimit')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const pl = state.selectedElement.querySelector('[data-wb-product-list]');
        if (pl) pl.dataset.wbProductCategory = $('#propProductCategory').value;
        saveHistory();
    });
    $('#propProductCategory')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const pl = state.selectedElement.querySelector('[data-wb-product-list]');
        if (pl) pl.dataset.wbProductCategory = $('#propProductCategory').value;
        saveHistory();
    });
    $('#propProductCurrency')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const pl = state.selectedElement.querySelector('[data-wb-product-list]');
        if (pl) pl.dataset.wbCurrency = $('#propProductCurrency').value;
        saveHistory();
    });
    $('#propBookingTitle')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const h3 = state.selectedElement.querySelector('h3');
        if (h3) h3.textContent = $('#propBookingTitle').value;
        saveHistory();
    });
    $('#propBookingSuccess')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const bf = state.selectedElement.querySelector('[data-wb-booking-form]');
        if (bf) bf.dataset.successMsg = $('#propBookingSuccess').value;
        saveHistory();
    });
    $('#propBookingTimes')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const timeSelect = state.selectedElement.querySelector('[name="time"]');
        if (!timeSelect) return;
        const times = $('#propBookingTimes').value.split(',').map(t => t.trim()).filter(t => t);
        timeSelect.innerHTML = '<option value="">Seleziona...</option>' +
            times.map(t => '<option>${t}</option>').join('');
        saveHistory();
    });
    $('#propPaymentName')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const n = state.selectedElement.querySelector('.wb-payment-product');
        if (n) n.textContent = $('#propPaymenName').value;
        saveHistory();
    });
    $('#propPaymentDesc')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const d = state.selectedElement.querySelector('.wb-payment-desc');
        if (d) d.textContent = $('#propPaymentDesc').value;
        saveHistory();
    });
    ['propPaymentAmount','propPaymentCurrency','propStripePrice', 'propPaymentSuccess'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            if (!state.selectedElement) return;
            const pm = state.selectedElement.querySelector('[data-wb-payment]');
            if (!pm) return;
            if (id === 'propPaymentAmount') {
                pm.dataset.wbAmoun = document.getElementById(id).value;
                const amtEl = state.selectedElement.querySelector('.wb-payment-amount');
                if (amtEl) amtEl.textContent = (document.getElementById('propPaymentCurrency'))
            }
            if (id === 'propPaymentCurrency') pm.dataset.wbCurrency = document.getElementById(id).value;
            if (id === 'propStripePrice') pm.dataset.wbStripePrice = document.getElementById(id).value;
            if (id === 'propPaymentSuccess') pm.dataset.successUrl = documentt.getElementById(id).value;
        });
    });
    $('#propNewsletterTitle')?.addEventListener('input', () => {
        if (!state.selectedElement) return;
        const h3 = state.selectedElement.querySelector('h3');
        if (h3) h3.textContent = $('#propNewsletterTitle').value;
        saveHistory();
    });
    $('#propNewsletterSubtitle').addEventListener('input',  () => {
        if (!state.selectedElement) return;
        const p = state.selectedElement.querySelector('p');
        if (p) p.textContent = $('#propNewsletterSubtitle').value;
        saveHistory();
    });
    $('#propNewsletterBtn')?.addEventListener('input', () => {
        if( !state.selectedElement) return;
        const btn = state.selectedElement.querySelector('[data-wb-newsletter-btn]');
        if (btn) btn.textContent = $('#propNewsletterBtn').value;
        saveHistory();
    });
    $('#propNewsletterSuccess')?.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const nl = state.selectedElement.querySelector('[data-wb-newsletter]');
        if (nl) nl.dataset.successMsg = $('#propNewsletterSuccess').value;
    });
}
function buildActionRow(action, index) {
    const row = document.createElement('div');
    row.style.cssText = 'border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;margin-bottom:6px;background:rgba(255,255,255,0.03);';
    const placeholders = { link: 'https://google.com', scroll: 'ID sezione, es: contatti', 'show-hide': 'ID elemento, es: menu' };
    const helps = {
        link: 'Apre una pagina web quando si clicca.',
        scroll: 'Scorre fino alla sezione con quell\'ID.',
        'show-hide': 'Mostra o nasconde l\'elemento con quell\'ID.',
        submit: 'Invia il modulo più vicino.'
    };
    row.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <select class="prop-input action-type-select" data-index="${index}" style="flex:1;">
                <option value="none">Niente</option>
                <option value="link">Apri una pagina web</option>
                <option value="scroll">Scorri fino a un punto</option>
                <option value="show-hide">Mostra o nascondi</option>
                <option value="submit">Invia il modulo</option>
                <option value="summon">Evoca elemento nascosto</option>
                <option value="toggle-visibility">Mostra/nascondi (toggle)</option>
            </select>
            <button class="remove-action-btn" data-index="${index}" style="background:rgba(255,60,60,0.2);border:none;border-radius:4px;color:#ff6b6b;cursor:pointer;padding:4px 8px;font-size:14px;">✕</button>
        </div>
        <div class="action-value-row" data-index="${index}" style="display:${(action.type === 'none' || action.type === 'submit') ? 'none' : 'block'};">
            <input type="text" class="prop-input action-value-input" data-index="${index}" placeholder="${placeholders[action.type] || ''}" value="${action.value || ''}">
        </div>
        <div class="action-newtab-row" data-index="${index}" style="display:${action.type === 'link' ? 'flex' : 'none'};align-items:center;gap:6px;margin-top:4px;">
            <input type="checkbox" class="action-newtab-check" data-index="${index}" style="width:14px;height:14px;" ${action.newTab ? 'checked' : ''}>
            <label style="font-size:11px;color:var(--text-secondary);">Apri in nuova scheda</label>
        </div>
        <div class="action-help" style="font-size:11px;color:var(--text-secondary);margin-top:4px;display:${action.type !== 'none' ? 'block' : 'none'};">${helps[action.type] || ''}</div>
    `;
    row.querySelector('.action-type-select').value = action.type;
    return row;
}

function renderActionsPanel(actions) {
    const container = $('#actionsContainer');
    container.innerHTML = '';
    actions.forEach((action, i) => {
        container.appendChild(buildActionRow(action, i));
    });
    container.querySelectorAll('.action-type-select').forEach(sel => {
        sel.addEventListener('change', () => {
            if (!state.selectedElement) return;
            let actions = [];
            try { actions = JSON.parse(state.selectedElement.dataset.actions || '[]'); } catch(e) {}
            const idx = parseInt(sel.dataset.index);
            actions[idx].type = sel.value;
            actions[idx].value = '';
            state.selectedElement.dataset.actions = JSON.stringify(actions);
            renderActionsPanel(actions);
            saveHistory();
        });
    });
    container.querySelectorAll('.action-value-input').forEach(inp => {
        inp.addEventListener('input', () => {
           if (!state.selectedElement) return;
           let actions = [];
           try { actions = JSON.parse(state.selectedElement.dataset.actions || '[]'); } catch(e) {}
           actions[parseInt(inp.dataset.index)].value = inp.value;
           state.selectedElement.dataset.actions = JSON.stringify(actions);
           saveHistory();
        });
    });
    container.querySelectorAll('.action-newtab-check').forEach(chk => {
        chk.addEventListener('change', () => {
            if (!state.selectedElement) return;
            let actions = [];
            try { actions = JSON.parse(state.selectedElement.dataset.actions || '[]'); } catch(e) {}
            actions[parseInt(chk.dataset.index)].newTab = chk.checked;
            state.selectedElement.dataset.actions = JSON.stringify(actions);
            saveHistory();
        });
    });
    container.querySelectorAll('.remove-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.selectedElement) return;
            let actions = [];
            try { actions = JSON.parse(state.selectedElement.dataset.actions || '[]'); } catch(e) {}
            actions.splice(parseInt(btn.dataset.index), 1);
            state.selectedElement.dataset.actions = JSON.stringify(actions);
            renderActionsPanel(actions);
            saveHistory();
        });
    });
}
function applyStyle(property, value) {
    if (!state.selectedElement) return;
    const el = state.selectedElement;
    const isBackground = el.dataset.type === 'background';
    if (isBackground && property === 'backgroundColor') {
        const bgChild = el.querySelector('.wb-background');
        if (bgChild) {
            bgChild.style.background = value;
        }
        el.style.backgroundColor = 'transparent';
    } else {
        const target = getStyleTarget(el);
        target.style[property] = value;  
    }
    clearTimeout(state._styleTimeout);
    state._styleTimeout = setTimeout(() => saveHistory(), 300);
}

function getStyleTarget(element) {
    const directChild = element.querySelector(
        '.wb-section, .wb-container, .wb-columns, .wb-grid, .wb-heading, ' +
        '.wb-paragraph, .wb-image, .wb-button, .wb-link, .wb-divider, ' +
        '.wb-spacer, .wb-video, .wb-icon, .wb-map, .wb-form, .wb-input, ' +
        '.wb-textarea-el, .wb-select, .wb-checkbox-wrapper, .wb-background, .wb-hero, ' +
        '.wb-navbar, .wb-footer, .wb-card, .wb-pricing, .wb-testimonial'
    );
    return directChild || element;
}
function getEditableContent(element) {
    return element.querySelector('[contenteditable]');
}

function updatePropertyPanel() {
    if (!state.selectedElement) return;
    const el = state.selectedElement;
    const target = getStyleTarget(el);
    const computed = window.getComputedStyle(target);

    const editable = getEditableContent(el);
    $('#propText').value = editable ? editable.textContent : '';

    const link = el.querySelector('a, .wb-link');
    $('#propLink').value = link ? link.href : '';

    const img = el.querySelector('img');
    $('#propImageSrc').value = img ? (img.getAttribute('src') || '') : '';
    $('#propAlt').value = img ? img.alt : '';

    $('#propFont').value = target.style.fontFamily || '';
    $('#propFontSize').value = parseInt(computed.fontSize) || '';
    $('#propFontWeight').value = computed.fontWeight || '400';
    $$('.prop-btn-icon[data-align]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === computed.textAlign);
    });

    const textColor = rgbToHex(computed.color);
    const bgColor = rgbToHex(computed.backgroundColor);
    $('#propColor').value = textColor;
    $('#propColorText').value = textColor;
    $('#propBgColor').value = bgColor !== '#00000000' ? bgColor : '#ffffff';
    $('#propBgColorText').value = bgColor !== '#00000000' ? bgColor: '#ffffff';

    $('#propLineHeight').value = parseFloat(computed.lineHeight) || '';
    $('#propLetterSpacing').value = parseFloat(computed.letterSpacing) || '';

    $('#propWidth').value = target.style.width || '';
    $('#propHeight').value = target.style.height || '';

    $('#propMarginTop').value = parseInt(computed.marginTop) || '';
    $('#propMarginRight').value = parseInt(computed.marginRight) || '';
    $('#propMarginBottom').value =parseInt(computed.marginBottom) || '';
    $('#propMarginLeft').value = parseInt(computed.marginLeft) || '';

    $('#propPaddingTop').value = parseInt(computed.paddingTop) || '';
    $('#propPaddingRight').value = parseInt(computed.paddingRight) || '';
    $('#propPaddingBottom').value = parseInt(computed.paddingBottom) || '';
    $('#propPaddingLeft').value = parseInt(computed.paddingLeft) || '';

    $('#propBorderWidth').value = parseInt(computed.borderTopWidth) || '';
    $('#propBorderStyle').value = computed.borderTopStyle || 'none';
    const borderColor = rgbToHex(computed.borderTopColor);
    $('#propBorderColor').value = borderColor;
    $('#propBorderColorText').value = borderColor;
    $('#propBorderRadius').value = parseInt(computed.borderRadius) || '';
    $('#propShadow').value = target.style.boxShadow || 'none';
    const opacity = Math.round(parseFloat(computed.opacity) * 100);
    $('#propOpacity').value = opacity;
    $('#opacityValue').textContent = opacity + '%';
    const display = target.style.display || computed.display;
    $('#propDisplay').value = display;
    $('#flexOptions').style.display = display === 'flex' ? 'block' : 'none';
    if (display === 'flex') {
        $('#propFlexDirection').value = computed.flexDirection || 'row';
        $('#propAlignItems').value = computed.alignItems || 'stretch';
        $('#propJustifyContent').value = computed.justifyContent || 'flex-start';
        $('#propGap').value = parseInt(computed.gap) || '';
    }

    $('#propPosition').value = computed.position || 'static';
    $('#propOverflow').value = computed.overflow || 'visible';

    $('#propId').value = el.id || el.dataset.elementId || '';
    const userClasses = Array.from(target.classList).filter(c => !c.startsWith('wb-') && c !== 'builder-element' && c !== 'selected');
    $('#propClasses').value = userClasses.join(' ');
    $('#propCustomCSS').value = '';
    const selectEl = el.querySelector('.wb-select');
    const selectGroup = $('#selectOptionsGroup');
    if (selectEl) {
        selectGroup.style.display = 'block';
        const opts = Array.from(selectEl.options).map(o => o.text).join('\n');
        $('#propSelectOptions').value = opts;
        $('#propSelectOptionActions').value = optionActionsToText(el.dataset.optionActions);
    } else {
        selectGroup.style.display = 'none';
        $('#propSelectOptions').value = '';
        $('#propSelectOptionActions').value = '';
    }
    const actionGroup = $('#actionGroup');
    const elType = el.dataset.type;
    const clickableTypes = ['button', 'link', 'image', 'icon', 'block-hero'];
    if (elType && clickableTypes.includes(elType)) {
        actionGroup.style.display = 'block';
        let actions = [];
        try { actions = JSON.parse(el.dataset.actions || '[]'); } catch(e) {}
        renderActionsPanel(actions);
    } else {
        actionGroup.style.display = 'none';
    }
    const propAnim = $('#propAnimation');
    if (propAnim) {
        propAnim.value = el.dataset.animation || 'none';
    }
    const propAnimSpeed = $('#propAnimSpeed');
    if (propAnimSpeed) {
        propAnimSpeed.value = el.dataset.animSpeed || '1';
        $('#animSpeedValue').textContent = (el.dataset.animSpeed || '1') + 's';
    }
    const propHoverAnim = $('#propHoverAnimation');
    if (propHoverAnim) {
        propHoverAnim.value = el.dataset.hoverAnimation || 'none';
    }

    const propClickAnim = $('#propClickAnim');
    if (propClickAnim) {
        propClickAnim.checked = el.dataset.clickAnim === 'true';
    }
    const propStartHidden = $('#propStartHidden');
    if (propStartHidden) {
        propStartHidden.checked = el.dataset.startHidden === 'true';
    }

    ['protectedConfig', 'roleGateConfig', 'progressConfig','blogListConfig','userDataConfig','leaderboardConfig','productListConfig','bookingFormConfig','paymentConfig','newsletterConfig'].forEach(id => {
        const cfgEl = document.getElementById(id);
        if (cfgEl) cfgEl.style.display = 'none';
    });
    switch(elType) {
        case 'block-protected': {
            $('#protectedConfig').style.display = 'block';
            const gate = el.querySelector('[data-wb-protected]');
            $('#propRequireRole').value = gate?.dataset.wbRequireRole || 'user';
            $('#propProtectedTitle').value = el.querySelector('.wb-protected-lock h3')?.textContent || '';
            $('#propProtectedMsg').value = el.querySelector('.wb-protected-lock p')?.textContent || '';
            $('#propProtectedRedirect').value = el.dataset.loginRedirect || '';
            break;
        }
        case 'block-role-gate': {
            $('#roleGateConfig').style.display = 'block';
            const rg = el.querySelector('[data-wb-role-show]');
            $('#propRoleGateRole').value = rg?.dataset.wbRoleShow || 'admin';
            break;
        }
        case 'block-progress': {
            $('#progressConfig').style.display = 'block';
            const pr = el.querySelector('[data-wb-progress]');
            $('#propProgressKey').value = pr?.dataset.wbProgress || '';
            $('#propProgressLabel').value = el.querySelector('.wb-progress-label')?.textContent || '';
            $('#propProgressUnit').value = pr?.dataset.wbProgressUnit || '%';
            $('#propProgressMax').value = pr?.dataset.wbProgressMax || 100;
            const addBtn = el.querySelector('[data-wb-progress-add]');
            $('#propProgressIncrement').value = addBtn?.dataset.wbProgressAdd || 10;
            $('#propProgressShowReset').checked = !!el.querySelector('[data-wb-progress-reset]');
            break;
        }
        case 'block-blog-list': {
            $('#blogListConfig').style.display = 'block';
            const bl = el.querySelector('[data-wb-blog-list]');
            $('#propBlogLimit').value = bl?.dataset.wbBlogLimit || 10;
            $('#propBlogCategory').value = bl?.dataset.wbBlogCategory || '';
            break;
        }
        case 'block-user-data': {
            $('#userDataConfig').style.display = 'block';
            const wd = el.querySelector('[data-wb-userdata]');
            $('#propUserDataKey').value = wd?.dataset.wbUserdata || '';
            $('#propUserDataLabel').value = el.querySelector('.wb-user-data-label')?.textContent || '';
            break;
        }
        case 'block-product-list': {
            const ppc = document.getElementBydId('productListConfig');
            if (ppc) ppc.style.display = 'block';
            const pll = el.querySelector('[data-wb-product-list');
            if ($('#propProductLimit')) $('#propProductLimit').value = pll?.dataset.wbProductLimit || 12;
            if ($('#propProductCategory')) $('#propProductCategory').value = pll?.dataset.wbProductCategory || '';
            if ($('#propProductCurrency')) $('#propProductCurrency').value = pll?.dataset.wbCurrency || '€';
            break;
        }
        case 'block-booking-form': {
            const bfc = document.getElementById('bookingFormConfig');
            if (bfc) bfc.style.display = 'block';
            if ($('#propBookingTitle')) $('#propBookingTitle').value = el.querySelector('h3')?.texContent || '';
            if ($('#propBookingSuccess')) $('#propBookingSuccess').value = el.querySelector('[data-wb-booking-form]')?.dataset.successMsg || '';
            break;
        }
        case 'block-payment': {
            const pmc = document.getElementById('paymentConfig');
            if (pmc) pmc.style.display = 'block';
            const pmEl = el.querySelector('[data-wb-payment]');
            if ($('#propPaymentName')) $('#propPaymentName').value = el.querySelector('.wb-payment-product')?.textContent || '';
            if ($('#propPaymentDesc')) $('#propPaymentDesc').value = el.querySelector('.wb-payment-desc')?.texContent || '';
            if ($('#propPaymentAmount')) $('#propPaymentAmount').value = pmEl?.dataset.wbAmount || '';
            if ($('#propPaymentCurrency')) $('#propPaymentCurrency').value = pmEl?.dataset.wbCurrency || '€';
            if ($('#propStripePrice')) $('#propStripePrice').value = pmEl?.dataset.wbStripePrice || '';
            break;
        }
        case 'block-newsletter': {
            const nlc = document.getElementById('newsletterConfig');
            if (nlc) nlc.style.display = 'block';
            if ($('#propNewsletterTitle')) $('#propNewsletterTitle').value = el.querySelector('h3')?.textContent || '';
            if ($('#propNewsletterSubtitle')) $('#propNewsletterSubTitle').value = el.querySelector('p')?.textContent || '';
            if ($('#propNewsletterBtn')) $('#propNewsletterBtn').value = el.querySelector('[data-wb-newsletter-btn]')?.textContent || '';
            if ($('#propNewsletterSuccess')) $('#propNewsletterSuccess'). value = el.querySelector('#[data-wb-newsletter]')?.dataset.successMsg || '';
            break;
        }


        case 'block-leaderboard': {
            $('#leaderboardConfig').style.display = 'block';
            const lb = el.querySelector('[data-wb-leaderboard]');
            $('#propLeaderboardKey').value = lb?.dataset.wbLeaderboard || '';
            $('#propLeaderboardTitle').value = el.querySelector('.wb-leaderboard-title')?.textContent || '';
            $('#propLeaderboardLimit').value = lb?.dataset.wbLeaderboardLimit || 10;
            break;
        }
    }
    
    const bgImageGroup = $('#backgroundImageGroup');
    if (bgImageGroup) {
        if (elType === 'background') {
            bgImageGroup.style.display = 'block';
            const bgChild = el.querySelector('.wb-background');
            if (bgChild) {
                const bgImg = bgChild.style.backgroundImage || '';
                const urlMatch = bgImg.match(/url\(['"]?([^'"]+)['"]?\)/);
                $('#propBgImage').value = urlMatch ? urlMatch[1] : '';
                $('#propBgSize').value = bgChild.style.backgroundSize || 'cover';
                $('#propBgRepeat').value = bgChild.style.backgroundRepeat || 'no-repeat';
            }
        } else {
            bgImageGroup.style.display = 'none';
        }
    }
}
function updateBorder() {
    const width = $('#propBorderWidth').value;
    const style = $('#propBorderStyle').value;
    const color = $('#propBorderColor').value;

    if (width && style !== 'none') {
        applyStyle('border', `${width}px ${style} ${color}`);
    } else {
        applyStyle('border', 'none');
    }
}

function parseSizeValue(val) {
    if (!val) return '';
    if (val == 'auto') return 'auto';
    if (val.includes('%') || val.includes('px') || val.includes('vh') || val.includes('vw') || val.includes('em') || val.includes('rem')) {
        return val;
    }
    return val + 'px';
}



function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#000000';
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}


function initPanelSections() {
    $$('.section-title').forEach(title => {
        title.addEventListener('click', () => {
            const targetId = title.dataset.toggle;
            const content = $('#' + targetId);
            if (content) {
                title.classList.toggle('collapsed');
                content.classList.toggle('hidden');
            }
        });
    });
}

function initToolbar() {
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnPreview').addEventListener('click', showPreview);
    $('#btnExport').addEventListener('click', showExport);
    $('#btnReset').addEventListener('click', () => {
        $('#resetOverlay').classList.add('visible');
    });
    $('#resetCancel').addEventListener('click', () => {
        $('#resetOverlay').classList.remove('visible');
    });
    $('#resetConfirm').addEventListener('click', () => {
        $('#resetOverlay').classList.remove('visible');
        resetCurrentProject();
    });
    $('#resetOverlay').addEventListener('click', (e) => {
        if (e.target === $('#resetOverlay')) {
            $('#resetOverlay').classList.remove('visible');
        }
    });
}
function resetCurrentProject() {
    structureHTML = '';
    freeHTML = '';
    pages[currentPageIndex].structureHTML = '';
    pages[currentPageIndex].freeHTML = '';
    if (currentMode === 'free') {
        freeHTML = '';
    } else {
        structureHTML = '';
    }
    canvas.innerHTML = '<div class="canvas-empty"><i class="fa-solid fa-plus-circle"></i><p>Trascina un elemento qui per iniziare</p><p class="hint">oppure scegli un blocco pronto dal pannello a sinistra</p></div>';
    deselectElement();
    showCanvasEmpty();
    state.history = [];
    state.historyIndex = -1;
    saveHistory();
    updateLayers();
}

function initViewport() {
    $$('.viewport-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.viewport-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            canvasWrapper.className = 'canvas-wrapper';
            if (view === 'tablet') {
                canvasWrapper.classList.add('tablet');
            } else if (view === 'mobile') {
                canvasWrapper.classList.add('mobile');
            }
        });
    });
}
function initContextMenu() {
    $$('.context-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            if (state.selectedElement) {
                handleElementAction(action, state.selectedElement);
            }
            hideContextMenu();
        });
    });

    document.addEventListener('click', () => {
        hideContextMenu();
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

function showContextMenu(x, y) {
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('visible');
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (y - rect.height) + 'px';
    }
}

function hideContextMenu() {
    contextMenu.classList.remove('visible');
}

    function initLayers() {
        $('#btnLayers').addEventListener('click', () => {
            layersPanel.classList.toggle('visible');
            updateLayers();
        });
    $('#closeLayers').addEventListener('click', () => {
        layersPanel.classList.remove('visible');
    });
}

function updateLayers() {
    layersTree.innerHTML = '';
    const elements = canvas.querySelectorAll(':scope > .builder-element');

    elements.forEach(el => {
        addLayerItem(el, 0);
    });
}

function addLayerItem(element, depth) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    if (depth === 1) item.classList.add('layer-indent');
    if (depth >= 2) item.classList.add('layer-indent-2');
    if (state.selectedElement === element) {
        item.classList.add('active');
    }

    const type = element.dataset.type || 'elemento';
    const label = element.dataset.label || getTypeLabel(type);
    const icon = getTypeIcon(type);

    item.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
    item.addEventListener('click', () => {
        selectElement(element);
        updateLayers();
    });
    layersTree.appendChild(item);

    const directChildren = [];
    element.querySelectorAll('.builder-element').forEach(child => {
        if (child.parentElement === element || child.parentElement.parentElement === element) {
            if (!directChildren.includes(child)) {
                directChildren.push(child);
            }
        }
    });

    directChildren.forEach(child => {
        if (child.classList.contains('builder-element')) {
            addLayerItem(child, depth + 1);
        }
    });
}
function getTypeIcon(type) {
const icons = {
    'section': 'fa-solid fa-layer-group',
    'container': 'fa-solid fa-box',
    'columns-2': 'fa-solid fa-columns',
    'columns-3': 'fa-solid fa-table-columns',
    'columns': 'fa-solid fa-square',
    'grid': 'fa-solid fa-grip',
    'heading': 'fa-solid fa-heading',
    'paragraph': 'fa-solid fa-paragraph',
    'image': 'fa-solid fa-image',
    'button': 'fa-solid fa-hand-pointer',
    'link': 'fa-solid fa-link',
    'divider': 'fa-solid fa-minus',
    'spacer': 'fa-solid fa-arrows-up-down',
    'video': 'fa-solid fa-video',
    'icon': 'fa-solid fa-icons',
    'map': 'fa-solid fa-map-location-dot',
    'background': 'fa-solid fa-fill-drip',
    'form-contact': 'fa-solid fa-envelope',
    'input': 'fa-solid fa-i-cursor',
    'textarea': 'fa-solid fa-align-left',
    'select': 'fa-solid fa-caret-down',
    'checkbox': 'fa-solid fa-square-check',
    'block-hero': 'fa-solid fa-panorama',
    'block-navbar': 'fa-solid fa-bars',
    'block-footer': 'fa-solid fa-shoe-prints',
    'block-card': 'fa-solid fa-id-card',
    'block-pricing': 'fa-solid fa-tags',
    'block-testimonial': 'fa-solid fa-quote-left',
    'block-login': 'fa-solid fa-right-to-bracket',
    'block-register': 'fa-solid fa-user-plus',
    'block-logout': 'fa-solid fa-right-from-bracket',
    'block-protected': 'fa-solid fa-lock',
    'block-role-gate': 'fa-solid fa-shield-halved',
    'block-user-profile': 'fa-solid fa-circle-user',
    'block-progress': 'fa-solid fa-chart-line',
    'block-blog-list': 'fa-solid fa-newspaper',
    'block-blog-editor': 'fa-solid fa-pen-to-square',
    'block-user-data': 'fa-solid fa-database',
    'block-leaderboard': 'fa-solid fa-ranking-star',
    'block-admin': 'fa-solid fa-user-shield',
    'block-product-list': 'fa-solid fa-store',
    'block-product-card': 'fa-solid fa-box-open',
    'block-cart': 'fa-solid fa-cart-shopping',
    'block-booking-form': 'fa-solid fa-calendar-check',
    'block-booking-admin': 'fa-solid fa-calendar-days',
    'block-payment': 'fa-solid fa-credit-card',
    'block-stripe-btn': 'fa-brands fa-stripe-s',
    'block-payment': 'fa-solid fa-credit-card',
    'block-stripe-btn': 'fa-brands fa-stripe-s',
    'block-paypal-btn': 'fa-brands fa-paypal',
    'block-newsletter': 'fa-solid fa-envelope-open-text'
    };
    return icons[type] || 'fa-solid fa-cube';
}

function saveHistory() {
    if (state.historyIndex < state.history.length -1) {
        state.history = state.history.slice(0, state.historyIndex +1);
    }

    const snapshot = canvas.innerHTML;
    state.history.push(snapshot);

    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
    state.historyIndex = state.history.length  -1;
}

function undo() {
    if(state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreHistory();
}

function redo() {
    if (state.historyIndex >= state.history.length - 1) return;

    state.historyIndex++;
    restoreHistory();
}

function restoreHistory() {
    const snapshot = state.history[state.historyIndex];
    if (!snapshot) return;
    canvas.innerHTML = snapshot;
    deselectElement();
    canvas.querySelectorAll('.builder-element').forEach(el => {
        setupElementEvents(el);
        if (currentMode === 'free') {
            addResizeHandles(el);
            addFreeDrag(el);
        }
    }); 
    showCanvasEmpty();
    updateLayers();
}

function initModals() {
    $('#closePreview').addEventListener('click', () => {
        previewModal.classList.remove('visible');
    });
    $('#closeExport').addEventListener('click', () => {
        exportModal.classList.remove('visible');
    });

    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) previewModal.classList.remove('visible');
    });

    exportModal.addEventListener('click', (e) => {
        if (e.target === exportModal) exportModal.classList.remove('visible');
    });

    $$('.export-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.export-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateExportCode(tab.dataset.export);
        });
    });
    $('#btnCopyCode').addEventListener('click', () => {
        const btn = $('#btnCopyCode');
        const original = btn.innerHTML;
        const text = codeOutput.textContent;
        function showCopied() {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiate!';
            setTimeout(() => {
                btn.innerHTML = original;
            }, 1500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
            .then(showCopied)
            .catch(() => fallbackCopy(text, showCopied));
        } else {
            fallbackCopy(text, showCopied);
        }
    });

    $('#btnDownloadZip').addEventListener('click', downloadZip);
}

function showPreview() {
    previewModal.classList.add('visible');
    const html = generateFullHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    previewFrame.src = url;
}

function showExport()  {
    exportModal.classList.add('visible');
    updateExportCode('html');
}

function updateExportCode(type) {
    switch (type) {
        case 'html':
            codeOutput.textContent = generateCleanHTML();
            break;
        case 'css':
            codeOutput.textContent = generateCleanCSS();
            break;
        case 'full':
            codeOutput.textContent = generateFullHTML();
            break;
    }
}

function generateCleanHTML() {
    const clone = canvas.cloneNode(true);
    clone.querySelectorAll('.element-actions, .drop-indicator, .canvas-empty, .resize-handle').forEach(el => el.remove());
    clone.querySelectorAll('.builder-element').forEach((el, i) => {
        el.classList.remove('builder-element', 'selected', 'drag-over');
        el.classList.add(`element-${i + 1}`);
        el.removeAttribute('data-type');
        el.removeAttribute('data-id');
        el.removeAttribute('data-label');
        el.removeAttribute('draggable');
        el.removeAttribute('data-pending');
        if (el.dataset.startHidden === 'true') {
            el.dataset.summoned = 'hidden';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.35s ease';
        } else {
            el.style.removeProperty('visibility');
            el.style.removeProperty('pointer-events');
            el.style.removeProperty('opacity');
            }
        el.removeAttribute('data-start-hidden');
    });

    clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
    });
    clone.querySelectorAll('form.wb-form').forEach(form => {
        const parentEl = form.closest('.builder-element');
        if (parentEl && parentEl.dataset.formspreeUrl) {
            form.removeAttribute('onsubmit');
            form.dataset.formspreeUrl = parentEl.dataset.formspreeUrl;
            form.dataset.formSuccessMsg = parentEl.dataset.formSuccessMsg || 'Grazie';
            form.dataset.formMultiple = parentEl.dataset.formMultiple || 'false';
        }
        if (parentEl && parentEl.dataset.sheetsUrl) {
            form.removeAttribute('onsubmit');
            form.dataset.sheetsUrl = parentEl.dataset.sheetsUrl;
        }
    });
    return formatHTML(clone.innerHTML);
}

function generateCleanCSS() {
    let css = '/* Stili generati da Web Builder */\n\n';
    css += '* { margin: 0; padding: 0; box-sizing: border-box; }\n';
    css += 'body { font-family: "Inter", -apple-system, sans-serif; }\n\n';

    const elements = canvas.querySelectorAll('.builder-element');
    elements.forEach((el, i) => {
     const target = getStyleTarget(el);
     if (target.style.cssText) {
         css += `.element-${i + 1} {\n`;
         target.style.cssText.split(';').forEach(rule => {
               const trimmed = rule.trim();
                if (trimmed) {
                    css += `    ${trimmed};\n`;
                }
            });
            css  += '}\n\n';
        }
    });
    return css;
}

function generateFullHTML() {
    const bodyContent = generateCleanHTML();
    const styles = generateInlineStyles();
    const sbUrl = $('#supabaseUrl').value || '';
    const sbKey = $('#supabaseKey').value || '';
    const cfg = JSON.stringify(advancedConfig);
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Il mio sito</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <style>
        * {margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; }
        img { max-width: 100%; height: auto; }
        .wb-profile-edit-btn { display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:7px 14px;background:#f0f4ff;border:1px solid #4361ee;color:#4361ee;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600; }
        .wb-profile-edit-btn:hover { background:#4361ee;color:white; }
        .wb-admin-tab { padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:#888;border-bottom:2px solid transparent; }
        .wb-admin-tab.active { color:#f4a261;border-bottom-color:#f4a261; }
        [data-wb-role-show] { display:none; }
        [data-wb-protected] .wb-protected-content { display:none; }
        [data-wb-protected] .wb-protected-lock { display:flex; }
${styles}
    </style>
</head>
<body>
${bodyContent}
<script>
var _sbUrl = '${sbUrl}';
var _sbKey = '${sbKey}';
var _cfg = ${cfg};
var _wbStripeKey = '${$('#stripeKey')?.value || ''}';
var _wbPaypalKey = '${$('#paypalClientId')?.value || ''}';
var _roles = _cfg.roles || ['user','premium','moderator','admin'];
var _u = null;
var _p = null;
function _ri(r) { var i = _roles.indexOf(r); return i === -1 ? 0 : i; }
function _hasRole(req) {
    if (req === 'guest') return true;
    if (!_u) return false;
    if (req === 'user') return true;
    var ur = _p ? (_p.role || 'user') : 'user';
    return _ri(ur) >= _ri(req);    
}
function _esc(s) { return String(s|| '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function _loadProfile() {
    if (!_u || !window._sb) return;
    try {
        var r = await window._sb.from('wb_profiles').select('*').eq('id', _u.id).maybeSingle();
        if (r.data) { _p = r.data; }
        else {
            var np = { id: _u.id, username: _u.email.split('@')[0], role: _cfg.defaultRole || 'user', bio: '' };
            await window._sb.from('wb_profiles').insert(np);
            _p = np;
        }
    } catch(e) { console.warn('Profile error:', e); }
}

function _applyGates() {
    document.querySelectorAll('[data-wb-protected]').forEach(function(el) {
        var req = el.dataset.wbRequireRole || 'user';
        var ok = _hasRole(req);
        var lock = el.querySelector('.wb-protected-lock');
        var content = el.querySelector('.wb-protected-content');
        if (lock) lock.style.display = ok ? 'none' : 'flex';
        if (content) content.style.display = ok ? '' : 'none';
    });
    document.querySelectorAll('[data-wb-role-show]').forEach(function(el) {
        el.style.display = _hasRole(el.dataset.wbRoleShow) ? '' : 'none';
    });
    document.querySelectorAll('[data-wb-user-profile]').forEach(function(el) {
        var nm = el.querySelector('[data-wb-username]');
        var em = el.querySelector('[data-wb-useremail]');
        var ro = el.querySelector('[data-wb-userrole]');
        var bi = el.querySelector('[data-wb-userbio]');
        var av = el.querySelector('[data-wb-avatar-letter]');
        if (_u && _p) {
            if (nm) nm.textContent = _p.username || _u.email.split('@')[0];
            if (em) em.textContent = _u.email;
            if (ro) ro.textContent = _p.role || 'user';
            if (bi) bi.textContent = _p.bio || '';
            if (av) av.textContent = (_p.username || _u.email || 'U')[0].toUpperCase();
        } else {
            if (nm) nm.textContent = 'Ospite';
            if (em) em.textContent = 'Non connesso';
            if (ro) ro.textContent = '';
            if (bi) bi.textContent = '';
            if (av) av.textContent = '?';
        
        }
    });
}
async function _loadProgress() {
    if (!_u || !window._sb) return;
    document.querySelectorAll('[data-wb-progress]').forEach(async function(el) {
        var key = el.dataset.wbProgress;
        var unit = el.dataset.wbProgressUnit || '%';
        var max = parseFloat(el.dataset.wbProgressMax) || 100;
        try {
            var r = await window._sb.from('wb_user_progress').select('value').eq('user_id', _u.id).eq('key', key).maybeSingle();
            var val = r.data ? (parseFloat(r.data.value) || 0) : 0;
            var fill = el.querySelector('.wb-progress-fill');
            var valEl = el.querySelector('.wb-progress-value');
            if (fill) fill.style.width = Math.min(100, val / max * 100) + '%';
            if (valEl) valEl.textContent = val + unit;
        } catch(e) {}
    });
}
async function _loadLeaderboards() {
    if (!window._sb) return;
    document.querySelectorAll('[data-wb-leaderboard]').forEach(async function(el) {
        var key = el.dataset.wbLeaderboard;
        var limit = parseInt(el.dataset.wbLeaderboardLimit) || 10;
        var body = el.querySelector('.wb-leaderboard-body');
        if (!body) return;
        try {
            var r = await window._sb.from('wb_user_progress')
                .select('user_id, value, wb_profiles(username)')
                .eq('key', key).order('value', { ascending: false }).limit(limit);
            if (!r.data || r.data.length === 0) { body.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Nessun dato ancora</div>'; return; }
            var medals= ['🥇','🥈','🥉'];
            body.innerHTML = r.data.map(function(item, i) {
                return '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0;">' +
                    '<span style="font-size:18px;min-width:30px;">' + (medals[i] || (i+1)+'.') + '</span>' +
                    '<span style="flex:1;font-weight:600;color:#333;">' + _esc(item.wb_profiles?.username || 'Utente') + '</span>' +
                    '<span style="font-weight:800;color:#4361ee;">' + item.value + '</span></div>';
            }).join('');      
        } catch(e) { body.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Errore caricamento</div>'; }
    });
}

async function _loadBlog() {
    if (!window._sb) return;
    document.querySelectorAll('[data-wb-blog-list]').forEach(async function(el) {
        var limit = parseInt(el.dataset.wbBlogLimit)  || 10;
        var cat = el.dataset.wbBlogCategory;
        try {
            var q = window._sb.from('wb_posts').select('*, wb_profiles(username)')
                .eq('published', true).order('created_at', { ascending: false }).limit(limit);
            if (cat) q = q.eq('category', cat);
            var r = await q;
            if (!r.data || r.data.length === 0) {
                el.innerHTML = '<div style="text-align:center;padding:40px;color:#999;"><i class="fa-solid fa-newspaper" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px;"></i>Nessun post ancora. Sii il primo!</div>';
                return;
            }
            el.innerHTML = r.data.map(function(post) {
                var canDel = _u && post.user_id === _u.id;
                var canMod = _p && _hasRole(_cfg.blogModerateRole || 'moderator');
                return '<div data-post-id="' + post.id + '" style="padding:20px;border:1px solid #eee;border-radius:8px;margin-bottom:16px;background:white;">' +
                    (post.category ? '<span style="font-size:11px;font-weight:700;padding:2px 10px;background:#f0f4ff;color:#4361ee;border-radius:20px;display:inline-block;margin-bottom:8px;">' + _esc(post.category) + '</span>' : '') +
                    '<h3 style="margin-bottom:8px;color:#333;font-size:18px;">' + _esc(post.title) + '</h3>' +
                    '<p style="color:#666;font-size:14px;line-height:1.6;margin-bottom:12px;">' + _esc((post.content||'').substring(0,300)) + ((post.content||'').length > 300 ? '...' : '') + '</p>' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
                    '<small style="color:#999;"><strong>' + _esc(post.wb_profiles?.username || 'Anonimo') + '</strong> . ' + new Date(post.created_at).toLocaleDateString('it-IT') + '</small>' +
                    '<div style="display:flex;gap:6px;">' +
                    (canDel ? '<button onclick="_delPost(\'' + post.id + '\')" style="background:none;border:1px solid #e63946;color:#e63946;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">Elimina</button>' : '') +
                    (canMod && !canDel ? '<button onclick="_delPost(\'' + post.id + '\')" style="background:none;border:1px solid #f4a261;color:#f4a261;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">Rimuovi</button>' : '') +
                    '</div></div></div>';
            }).join('');
        } catch(e) { el.innerHTML = '<div style="color:#e63946;padding:20px;text-align:center;">Errore caricamento post</div>'; }
    });
}

async function _delPost(id) {
    if (!_u) return;
    if (!confirm('Eliminare questo post?')) return;
    await window._sb.from('wb_posts').delete().eq('id', id);
    var el = document.querySelector('[data-post-id="'+id+'"]');
    if (el) el.remove();   
}

async function _loadUserData() {
    if (!_u || !window._sb) return;
    document.querySelectorAll('[data-wb-userdata]').forEach(async function(el) {
        var key = el.dataset.wbUserdata;
        try {
            var r = await window._sb.from('wb_user_data').select('value').eq('user_id', _u.id).eq('key', key).maybeSingle();
            var val = r.data ? r.data.value : null;
            var disp = el.querySelector('[data-wb-data-value]');
            var inp = el.querySelector('[data-wb-data-input]');
            if (disp) disp.textContent = val !== null ? val : '-';
            if (inp && val !== null) inp.value = val;
        } catch(e) {}
    });
}

async function _loadAdmin() {
    if (!_p || !_hasRole('admin') || !window._sb) return;
    var usersEl = document.querySelector('[data-wb-admin-content="users"]');
    if (usersEl) {
        try {
            var r = await window._sb.from('wb_profiles').select('*').order('created_at', { ascending: false }).limit(50);
            if (r.data) {
                usersEl.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead><tr style="background:#f8f9fa;"><th style="padding:10px;text-align:left;border-bottom:2px solid #eee;">Username</th><th style="padding:10px;text-align:left;border-bottom:2px solid #eee;">Email</th><th style="padding:10px;border-bottom:2px solid #eee;">Ruolo</th><th style="padding:10px;border-bottom:2px solid #eee;">Azione</th></tr></thead><tbody>' +
                    r.data.map(function(user) {
                        return '<tr style="border-bottom:1px solid #f0f0f0;">' +
                            '<td style="padding:10px;">' + _esc(user.username || '-') + '</td>' +
                            '<td style="padding:10px;color:#888;">' + _esc(user.id.substring(0,8) + '...') + '</td>' +
                            '<td style="padding:10px;text-align:center;"><select onchange="_changeRole(\'' + user.id + '\',this.value)" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
                            _roles.map(function(role) { return '<option value="' + role + '"' + (user.role === role ? ' selected' : '') + '>' + role + '</option>'; }).join('') +
                            '</select></td>' +
                            '<td style="padding:10px;text-align:center;">' +
                            (user.id !== (_u?.id||'') ? '<button onclick="_banUser(\'' + user.id + '\')" style="background:none;border:1px solid #e63946;color:#e63946;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;" 10px;cursor:pointer;font-size:11px;cursor:pointer;font-size:11px;">Ban</button>' : '<em style="color:#999;font-size:11px;">Tu</em>') +
                            '</td></tr>';
                    }).join('') + '</tbody></table></div>';
            }
        } catch(e) { usersEl.innerHTML = '<p style="color:#e63946;padding:20px;">Errore caricamento utenti</p>'; }
    }
    var postsEl = document.querySelector('[data-wb-admin-content="posts"]');
    if (postsEl) {
        try {
            var rp = await window._sb.from('wb_posts').select('*, wb_profiles(username)').order('created_at', { ascending: false }).limit(30);
            if (rp.data) {
                postsEl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead><tr style="background:#f8f9fa;"><th style="padding:10px;text-align:left;border-bottom:2px solid #eee;">Titolo</th><th style="padding:10px;border-bottom:2px solid #eee;">Autore</th><th style="padding:10px;border-bottom:2px solid #eee;">Stato</th><th style="padding:10px;border-bottom:2px solid #eee;">Azione</th></tr></thead><tbody>' +
                    rp.data.map(function(post) {
                        return '<tr style="border-bottom:1px solid #f0f0f0;">' +
                            '<td style="padding:10px;">' + _esc((post.title||'').substring(0,40)) + '</td>' +
                            '<td style="padding:10px;text-align:center;color:#888;">' + _esc(post.wb_profiles?.username || '?') + '</td>' +
                            '<td style="padding:10px;text-align:center;">' + (post.published ? '<span style="color:green;font-size:11px;"> Pub.</span>' : '<span style="color:orange;font-size:11px;"> Bozza</span>') + '</td>' +
                            '<td style="padding:10px;text-align:center;"><button onclick="_adminDelPost(\'' + post.id + '\')" style="background:none;border:1px solid #e63946;color:#e63946;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;">Rimuovi</button></td></tr>';
                    }).join('') + '</tbody></table>';
            }
        } catch(e) {}
    }
    var statsEl = document.querySelector('[data-wb-admin-content="stats"]');
    if (statsEl) {
        try {
            var ru = await window._sb.from('wb_profiles').select('id', { count: 'exact', head: true });
            var rpo = await window._sb.from('wb_posts').select('id', { count: 'exact', head: true }).eq('published', true);
            statsEl.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px;">' +
                '<div style="background:#f0f4ff;border-radius:8px;padding:20px;text-align:center;"><div style="font-size:36px;font-weight:800;color:#4361ee;">' + (ru.count || 0) + '</div><div style="font-size:13px;color:#666;margin-top:4px;">Utenti registrati</div></div>' +
                '<div style="background:#f0f4ff;border-radius:8px;padding:20px;text-align:center;"><div style="font-size:36px;font-weight:800;color:#2ec4b6;">' + (rpo.count || 0) + '</div><div style="font-size:13px;color:#666;margin-top:4px;">Post pubblicati</div></div>' +
                '</div>';
        } catch(e) {}
    }
}

async function _loadProducts() {
    if (!window._sb) return;
    document.querySelectorAll('[data-wb-product-list]').forEach(async function(el) {
        var limit = parseIn(el.dataset.wbProductLimit) || 12;
        var category = el.dataset.wbProductCategory;
        var currency = el.dataset.wbCurrency || '€';
        var cols = el.dataset.wbProductCols || 'auto';
        if (cols !== 'auto') el.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
        try {
            var q = window._sb.from('wb_products').select('*').eq('published', true).order('created_at', {ascending:false}).limit(limit);
            if (category) q = q.eq('category', category);
            var r = await q;
            if (!r.data || r.data.lenght === 0) {
                el.innerHTML '<div style="text-align:center;padding:40px;color:#999;grid-column:1/-1:"><i class="fa-solid fa-store" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px;"></i>Nessun prodott disponibile</div>';
                return;
            }
            el.innerHTML = r.data.map(function(p) {
                var inStock = p.stock === -1 || p.stock > 0;
                return '<div style="background:white;border:1px solid #eee#border-radius:8px;overflow:hidden;">' +
                    '<div style=width:100%;height:180px;background:#f00f0f0;display:flex;align-items:center;justify-content:center;overflow-hidden;">' +
                    (p.image_url ? '<img src="' + _esc(p.image_url) + '" style="width:100%; object-fit:cover;">' : '<i class="fa-solid fa-box-open" style="font-size:32px;color:#bbb;"></i>') +
                    '</div><div style="padding:14px;">' +
                    (p.category ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;background:#f0f4ff;color:#4361ee;border-radius:20px;text-transform:uppercase;display:inline-block;margin-bottom:6px;">') + _esc(p.category) + '</span>' : '') +
                    '<div style="font-size:15px;font-weight:700;color:#333;margin-bottom:4px;">' + _esc(p.name) + '</div>' +
                    (p.description ? '<div style="font-size:13px;color:#777;line-height:1.4;margin-bottom:10px;">' + _esc(p.description.substring(0.80)) + (p.description.lenght > 80 ? '...' : '') + '</div>' : '') +
                    '<div style="font-size:22px;font-weight:800;color:#4361ee;margin-bottom:12px;">' + currency + parseFloat(p.price||0).toFixed(2) + '</div>' +
                    (!inStock ? '<div style"color:#e63946;font-size:12px;font-weight:600;margin-bottom:8px;"> Esaurito</div>' : '') +
                    '<button onclick="_addToCart(\'' + p.id + '\','\'' + _esc(p.name) + '\',' (p.price||0) + ',\'' + _esc(p.image.url||'') + '\',\'' + currency + '\')" style="width:100%;padding:10px;background:' + (inStock ? '#4361ee' : '#ccc') è ';color:white;border:none;border-radius:6px;cursor:' + (inStock ? 'pointer' : 'default') + ';font-size:13px;font-weight:600;"' + (!inStock ? ' disabled' : '') + '>' +
                    (inStock ? ' Aggiungi al carrello' : 'Non disponibile') + '</button>' +
                    '</div></div>';
            }).join('');
        } catch(e) {el.innerHTML = '<div style="color:#e63946;padding:20px;text-align:center;grid-column:1/1;">Errore caricamento prodotti</div>'; }
    });
}
var _cart = [];
try { _cart = JSON.parse(localStorage.getItem('_wbCart') || '[]'); } catch(e) {}

function _addToCart(id, name, price, imageUrl, currency) {
    var existing = _cart.find(function(i) { return i.id === id; });
    if (existing) { existing.qty++; } else {_cart.push({id:id,name:name,price:parseFloat(price),imageUrl:imageUrl,currency:currency,qty:1}); }
    localStorage.setItem('_wbCart', JSON.stringify(_cart));
    _updateCarts();
}
function _removeFromCart(id) {
    _cart = _cart.filter(function(i) { return i.id !== id; });
    localStorage.setItem('_wbCart', JSON.stringidy(_cart));
    _updateCarts();    
}
function _changeQty(id, delta) {
    var item = _cart.find(function(i) { return i.id === id; });
    id (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) _cart = _cart.filter(function(i) { return i.id !=== id; });
    localStorage.setItem('_wbCart', JSON.stringify(_cart));
    _updateCarts();
}
function _updateCarts() {
    document.querySelectorAll('[data-wb-cart]').forEach(function(cartEl) {
        var currency = cartEl.dataset.wbCurrency || '€';
        var body = cartEl.querySelector('[data-wb-cart-body]');
        var totalEl = cartEl.querySelector('[data-wb-cart-total]');
        var countEl = cartEl.querySelector('[data-wb-cart-count]');
        if (countEl) countEl.textContent = _cart.reduce(function(s,i){return s+i.qty;},0);
        if (body) {
            if (_cart.lenght === 0) {
                body.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:14px;"><i class="fa-solid fa-cart-shopping" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Il carrello è vuoto</div>';
            } else {
                body.innerHTML = _cart.map(function(item) {
                    return '<div style=display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0;">' +
                        (item.imageUrl ? '<img src="'+_esc(item.imageUrl)+'" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">' : '<div style="width:48px;height:48px;height:48px;background:#f0f0f0;border-radius:6px;display:flex;align-item:center;justify-content:center;"><i class="fa-solid fa-box-open" style="color:#bbb;fon-size:16px;"></i></div>') +
                        '<div style="flex:1;><div style="font-size:14px;fon-weigh:600;color:#333;">' + _esc(item.name) + '</div><div style="font-size:13px;color:#888;"> + item.currency + parseFloat(item.price).toFixed(2) + '</div></div>' +
                        '<div style="display:flex;align-items:center;gap:6px;">' +
                        '<button onclick="_changeQty(\''+item.id+'\',-1)" style="width:24px;height:24px;border-radius:50%;border:1px solid #ddd;background:none;cursor:pointer;">-</button>' +
                        '<span style="font-weight:600;min-weight:600;min-width:20px;text-align:center;">'+item.qty+'</span>' +
                        '<button onclick="_changeQty(\''+item.id+'\',1)" style="width:24px;height:24px;border-radius:50%;border:1px solid #ddd;background:none;cursor:pointer;">+</button>' +
                        '<button onclick="_removeFromCart(\''+item.id+'\')" style="background:none;border:none;color:#e63946;cursor:pointer;font-size:16px;padding:2px 4px;">X</button> +
                        '</div></div>' ;
                }).joind('');  
            }
        }
        if (totalEl) {
            var total = _cart.reduce(function(s,i){return s+(i.price*i.qty);},0);
            totalEl.textContent = currency + total.toFixed(2);
        }
    });
}

async function _loadBookingAdmin() {
    if (!_p || !_hasRole('admin') || !window._sb) return;
    document.querySelectorAll('[data-wb-booking-admin]').forEach(async function(el) {
        var tableEl = el.querySelector('[data-wb-booking-table]');
        if (!tableEl) return;
        try {
            var r = await.window._sb.from('wb_bookings').select('*').order('booking_date', {ascending:true}).limit(50);
            if (!r.data || r.data.lenght === 0) {tableEl.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Nessuna prenotazione</p>'; return; }
            var sc = {pending:#f4a261',confirmed:'#2ec4b6',cancelled:'#e63946'};
            var sl = {pending:' In attessa',confirma:' Confermata',cancelled:' Cancellata'};
            tableEl.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                '<thead><tr style="background:#f8f9fa;"><th style="padding:10px;text-align:left;border-bottom:2px solid #eee;">Nome</th><th style="padding:10px;border-bottom:2px solid #eee;">Servizio</th><th style="padding:10px;border-bottom:2px solid #eee;">Data/Ore</th><th style="padding:10px;border-bottom:2px solid #eee;">Stato</th><th style="padding:10px;border-bottom:2px solid #eee;">Azioni</th></tr></thead><tbody>' +
                r.data.map(function(b) {
                    return '<tr style="border-bottom:1px solid #f0f0f0;">' +
                        '<td style="padding:10px;">'+ _esc(b.name||'-') + '<br><small style="color:#888;">' + _esc(b.email||'') + '</small></td>' +
                        '<td style="padding:10px;text-align:center;">' + _esc(b.service||'-') + '</td>' +
                        '<td style="padding:10px;text-align:center;">' + (b.booking_date ? new Date(b.booking_date).toLocaleDateString('it-IT') : '-') + '</td>' +
                        '<td style="padding:10px;text-align:center;"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + (sc[b.status]||#888') + '20;color:' + (sc[b.status]||'#888') + ';">' + (sl[b.status]||b.status) + '</span></td>' +
                        '<td style="padding:10px;text-align:center;display:flex;gap:4px;justify-content:center;">' +
                        (b.status !== 'confirmed' '<>)
                })



        }
    })
}


async function _changeRole(userId, newRole) {
    if (!_hasRole('admin') || !window._sb) return;
    await window._sb.from('wb_profiles').update({ role: newRole }).eq('id', userId);
}
async function _banUser(userId) {
    if (!_hasRole('admin') || !window._sb) return;
    if (!confirm('Impostare questo utente come "banned"?')) return;
    await window._sb.from('wb_profiles').update({ role: 'banned' }).eq('id', userId);
    await _loadAdmin();
}

async function _adminDelPost(id) {
    if (!_hasRole('admin') || !window._sb) return;
    if (!confirm('Eliminare definitivamente questo post?')) return;
    await window._sb.from('wb_posts').delete().eq('id', id);
    await _loadAdmin();
}
function _setupListeners() {
    document.querySelectorAll('.wb-admin-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var panel = tab.closest('[data-wb-role-show]') || tab.closest('.wb-admin-panel') || document;
            panel.querySelectorAll('.wb-admin-tab').forEach(function(t) { t.classList.remove('active'); });
            panel.querySelectorAll('[data-wb-admin-content]').forEach(function(c) { c.style.display = 'none'; });
            tab.classList.add('active');
            var c = panel.querySelector('[data-wb-admin-content="' + tab.dataset.wbAdminTab + '"]');
            if (c) c.style.display = '';
        });
    });
    document.querySelectorAll('[data-auth-login]').forEach(function(form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var eEl = form.querySelector('[name="email"]'), pEl = form.querySelector('[name="password"]');
            var btn = form.querySelector('[type="submit"]');
            if (!eEl || !pEl) return;
            if (btn) { btn.disabled = true; btn.textContent = 'Accesso...'; }
            var r = await window._sb.auth.signInWithPassword({ email: eEl.value, password: pEl.value });
            if (r.error) {
                alert('Errore: ' + r.error.message);
                if (btn) { btn.disabled = false; btn.textContent = 'Accedi'; }    
            } else {
                _u = r.data.user;
                await _loadProfile();
                _applyGates();
                await Promise.all([_loadProgress(), _loadUserData(), _loadBlog(), _loadLeaderboards(), _loadAdmin()]);
                var red = form.dataset.loginRedirect;
                if (red) window.location.href = red;
            }
        });
    });
    document.querySelectorAll('[data-auth-register]').forEach(function(form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var eEl = form.querySelector('[name="email"]'), pEl = form.querySelector('[name="password"]'), uEl = form.querySelector('[name="username"]');
            var btn = form.querySelector('[type="submit"]');
            if (!eEl || !pEl) return;
            if (btn) { btn.disabled = true; btn.textContent = 'Registrazione...'; }
            var r = await window._sb.auth.signUp({ email: eEl.value, password: pEl.value });
            if (r.error) {
                alert('Errore: ' + r.error.message);
                if (btn) { btn.disabled = false; btn.textContent = 'Registrati'; }
            } else {
                if (uEl && r.data.user) {
                    await window._sb.from('wb_profiles').upsert({ id: r.data.user.id, username: uEl.value.trim(), role: '${advancedConfig.defaultRole || 'user'}' });
                }
                alert('Registrazione completata! Controlla la tua email.');
                if (btn) { btn.disabled = false; btn.textContent = 'Registrati'; }
            }
        });
    });
    document.querySelectorAll('[data-auth-logout]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            await window._sb.auth.signOut();
            _u = null; _p = null;
            _applyGates();
            var red = btn.dataset.logoutRedirect;
            if (red) window.location.href = red;
            else window.location.reload();
        });
    });
    document.querySelectorAll('[data-wb-progress-add]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            if (!_u) { alert('Devi fare login!'); return; }
            var tr = btn.closest('[data-wb-progress]');
            if (!tr) return;
            var key = tr.dataset.wbProgress, amount = parseFloat(btn.dataset.wbProgressAdd) || 1;
            var max = parseFloat(tr.dataset.wbProgressMax) || 100, unit = tr.dataset.wbProgressUnit || '%';
            try {
                var r = await window._sb.from('wb_user_progress').select('value').eq('user_id', _u.id).eq('key', key).maybeSingle();
                var cur = r.data ? (parseFloat(r.data.value) || 0) : 0;
                var nv = Math.min(max, cur + amount);
                await window._sb.from('wb_user_progress').upsert({ user_id: _u.id, key: key, value: nv, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
                var fill = tr.querySelector('.wb-progress-fill'), valEl = tr.querySelector('.wb-progress-value');
                if (fill) fill.style.width = (nv / max * 100) + '%';
                if (valEl) valEl.textContent = nv + unit;
                await _loadLeaderboards();
            } catch(e) { alert('Errore salvataggio'); }
        });
    });
    document.querySelectorAll('[data-wb-progress-reset]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            if (!_u || !confirm('Azzerare il progresso?')) return;
            var tr = btn.closest('[data-wb-progress]');
            if (!tr) return;
            var key = tr.dataset.wbProgress, unit = tr.dataset.wbProgressUnit || '%';
            await window._sb.from('wb_user_progress').upsert({ user_id: _u.id, key: key, value: 0, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
            var fill = tr.querySelector('.wb-progress-fill'), valEl = tr.querySelector('.wb-progress-value');
            if (fill) fill.style.width = '0%';
            if (valEl) valEl.textContent = '0' + unit;
            await _loadLeaderboards();
        }); 
    });
    document.querySelectorAll('[data-wb-data-save]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            if (!_u) { alert('Devi fare login!'); return; }
            var w = btn.closest('[data-wb-userdata]');
            if (!w) return;
            var key = w.dataset.wbUserdata, inp = w.querySelector('[data-wb-data-input]'), val = inp ? inp.value : '';
            try {
                await window._sb.from('wb_user_data').upsert({ user_id: _u.id, key: key, value: val, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
                var disp = w.querySelector('[data-wb-data-value]');
                if (disp) disp.textContent = val;
                var orig = btn.textContent; btn.textContent = ' Salvato!';
                setTimeout(function() { btn.textContent = orig; }, 2000);
            } catch(e) { alert('Errore salvataggio'); }
        });
    });
    document.querySelectorAll('[data-wb-blog-editor]').forEach(function(editor) {
        var titleEl = editor.querySelector('[data-wb-blog-title]');
        var contentEl = editor.querySelector('[data-wb-blog-content]');
        async function submit(published) {
            if (!_u) { alert('Devi fare login per pubblicare!'); return; }
            if (!_hasRole(_cfg.blogPublishRole || 'user')) { alert('Non hai i permessi per pubblicare.'); return; }
            var title = titleEl ? titleEl.value.trim() : '';
            var content = contentEl ? contentEl.value.trim() : '';
            if (!title && published) { alert('Inserisci un titolo!'); return; }
            try {
                var r = await window._sb.from('wb_posts').insert({ user_id: _u.id, title: title, content: content, category: editor.dataset.wbBlogCategory || 'Generale', published: published });
                if (r.error) throw r.error;
                if (titleEl) titleEl.value = '';
                if (contentEl) contentEl.value = '';
                alert(published ? 'Post pubblicato! ' : 'Bozza salvata! ');
                if (published) await _loadBlog();
            } catch(e) { alert('Errore: ' + e.message); }
        }
        var pb = editor.querySelector('[data-wb-blog-publish]');
        var db = editor.querySelector('[data-wb-blog-draft]');
        if (pb) pb.addEventListener('click', function() { submit(true); });
        if (db) db.addEventListener('click', function() { submit(false); });
    });
    document.querySelectorAll('[data-wb-profile-edit]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (!_u) { alert('Devi fare login!'); return; }
            var modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);';
            modal.innerHTML = '<div style="background:white;border-radius:16px;padding:30px;width:90%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
                '<h3 style="margin-bottom:20px;font-size:20px;color:#333;"> Modifica Profilo</h3>' +
                '<label style="display:block;font-size:12px;font-weight:600;color:#666;margin-bottom:4px;text-transform:uppercase;">Username</label>' +
                '<input id="_wbUn" type="text" value="' + _esc(_p?.username||'') + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:14px;font-size:14px;box-sizing:border-box;">' +
                '<label style="display:block;font-size:12px;font-weight:600;color:#666;margin-bottom:4px;text-transform:uppercase;">Bio</label>' +
                '<textarea id="_wbBio" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:14px;font-size:14px;resize:vertical;min-height:80px;box-sizing:border-box;">' + _esc(_p?.bio||'') + '</textarea>' +
                '<label style="display:block;font-size:12px;font-weight:600;color:#666;margin-bottom:4px;text-transform:uppercase;">URL Foto Profilo</label>' +
                '<input id="_wbAv" type="text" value="' + _esc(_p?.avatar_url||'') + '" placeholder="https://..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:20px;font-size:14px;box-sizing:border-box;">' +
                '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
                '<button id="_wbCancel" style="padding:10px 20px;background:#f0f0f0;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Annulla</button>' +
                '<button id="_wbSave" style="padding:10px 20px;background:#4361ee;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Salva</button>' +
                '</div></div>';
            document.body.appendChild(modal);
            modal.querySelector('#_wbCancel').addEventListener('click', function() { modal.remove(); });
            modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
            modal.querySelector('#_wbSave').addEventListener('click', async function() {
                var un = modal.querySelector('#_wbUn').value.trim();
                var bio = modal.querySelector('#_wbBio').value.trim();
                var av = modal.querySelector('#_wbAv').value.trim();
                var saveBtn = modal.querySelector('#_wbSave');
                saveBtn.disabled = true; saveBtn.textContent = 'Salvataggio...';
                try {
                    var r = await window._sb.from('wb_profiles').upsert({ id: _u.id, username: un, bio: bio, avatar_url: av, role: _p?.role || 'user' });
                    if (r.error) throw r.error;
                    _p = Object.assign({}, _p, { username: un, bio: bio, avatar_url: av });
                    _applyGates();
                    modal.remove();
                } catch(e) { alert('Errore: ' + e.message); saveBtn.disabled = false; saveBtn.textContent = 'Salva'; }
            });
        });
    });
    document.querySelectorAll('.wb-protected-lock .wb-button').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var gate = btn.closest('[data-wb-protected]');
            var red = gate ? gate.dataset.loginRedirect : null;
            if (red) { window.location.href = red; return; }
            var loginForm = document.querySelector('[data-auth-login]');
            if (loginForm) loginForm.scrollIntoView({ behavior: 'smooth' });
        });
    });
    document.addEventListener('click', function(e) {
        var actionEl = e.target.closest('[data-actions]');
        if (!actionEl) return;
        var actions = [];
        try { actions = JSON.parse(actionEl.dataset.actions); } catch(err) {}
        actions.forEach(function(action) {
            if (action.type === 'link' && action.value) {
                if (action.newTab) window.open(action.value, '_blank');
                else window.location.href = action.value;
            } else if (action.type === 'scroll' && action.value) {
                var t = document.getElementById(action.value);
                if (t) t.scrollIntoView({ behavior: 'smooth' });
            } else if ((action.type === 'show-hide' || action.type === 'summon' || action.type === 'toggle-visibility') && action.value) {
                var t = document.getElementById(action.value);
                if (t) {
                    var h = t.style.visibility === 'hidden' || t.style.opacity === '0';
                    t.style.transition = 'opacity 0.3s ease';
                    t.style.visibility = h ? 'visible' : 'hidden';
                    t.style.opacity = h ? '1' : '0';
                    t.style.pointerEvents = h ? 'auto' : 'none';
                }
            } else if (action.type === 'submit') {
                var f = actionEl.closest('form');
                if (f) f.submit();
            }
        });
    });
    document.addEventListener('click', function(e){
        var el = e.target.closest('[data-click-anim="true"]');
        if (!el) return;
        var t = el.querySelector('.wb-button,.wb-link,.wb-icon,.wb-image') || el;
        t.classList.remove('animate__animated','animate__pulse');
        void t.offsetWidth;
        t.style.setProperty('animation-duration','0.2s','important');
        t.classList.add('animate__animated','animate__pulse');
    });
    document.addEventListener('mouseover', function(e) {
        var el = e.target.closest('[data-hover-animation]');
        if (!el) return;
        var h = el.dataset.hoverAnimation;
        if (!h || h === 'none' || h === 'hover-grow' || h === 'hover-shrink') return;
        el.classList.remove('animate__animated','animate__'+h);
        void el.offsetWidth;
        el.style.setProperty('animation-duration',(el.dataset.animSpeed||'0.8')+'s','important');
        el.style.animationFillMode = 'both';
        el.classList.add('animate__animated','animate__'+h);
    });
    document.addEventListener('mouseout', function(e) {
        var el = e.target.closest('[data-hover-animation]');
        if (!el) return;
        var h = el.dataset.hoverAnimation;
        if (!h || h === 'none' || h === 'hover-grow' || h === 'hover-shrink') return;
        el.classList.remove('animate__animated','animate__'+h);
    });
    document.querySelectorAll('form[data-formspree-url]').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var url = form.dataset.formspreeUrl, msg = form.dataset.formSuccessMsg || 'Grazie!';
            fetch(url, { method:'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
            .then(function(r) {
                if (r.ok) {
                    if (form.dataset.formMultiple === 'true') { form.reset(); alert(msg); }
                    else { form.innerHTML = '<div style="text-align:center;padding:30px;color:#2ec4b6;font-size:16px;font-weight:600;">' + msg + '</div>; }
                } else { alert('Errore invio. Riprova.'); }
            }).catch(function() { alert('Errore di connessione.'); });
        });
    });
    document.querySelectorAll('form[data-sheets-url]').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var data = {};
            new FormData(form).forEach(function(v, k) { data[k] = v; });
            fetch(form.dataset.sheetsUrl, { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
            .then(function(r) { if (r.ok) { form.reset(); alert('Dati salvati!'); } })
            .catch(function() {});
        });
    });
    var _animObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var el = entry.target, anim = el.dataset.animation, speed = (el.dataset.animSpeed||'1')+'s';
                if (anim && anim !== 'none') {
                    el.classList.remove('animate__animated', 'animate__'+anim);
                    void el.offsetWidth;
                    el.style.setProperty('animation-duration', speed, 'important');
                    el.style.animationFillMode = 'both';
                    el.classList.add('animate__animated','animate__'+anim);
                    _animObserver.unobserve(el);
                }
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('[data-animation]').forEach(function(el) {
        if (el.dataset.animation && el.dataset.animation !== 'none') _animObserver.observe(el);
    });
}
async function _initWB() {
    _updateCarts();
    _setupBookings();
    _setupPayments();
    _setupNewsletter();
    if (!_sbUrl || !_sbKey) return;
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = async function() {
        window._sb = supabase.createClient(_sbUrl, _sbKey);
        var res = await window._sb.auth.getUser();
        _u = res.data?.user || null;
        if (_u) await _loadProfile();
        _applyGates();
        _setupListeners();
        await Promise.all([_loadProgress(), _loadUserData(), _loadBlog(), _loadLeaderboards(), _loadAdmin(), _loadProducts(), _loadBookingAdmin()]);
        _updateCarts();
        _setupBooking();
        _setupPayments();
        _setupNewsletter();
        window._sb.auth.onAuthStateChange(async function(event, session) {
            _u = session ? session.user : null;
            if (_u) await _loadProfile(); else _p = null;
            _applyGates();
            await Promise.all([_loadProgress(), _loadUserData(), _loadBlog(), _loadLeaderboards(), _loadAdmin(), _loadProducts(), _loadBookingAdmin()]);
        });
    };
    document.head.appendChild(script);
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _initWB; }
else { _initWB(); }
<\/script>
</body>
</html>`;
}

function generateInlineStyles() {
    return `
        .wb-section { padding: 60px 20px; }
        .wb-container { max-width: 1100px; margin: 0 auto; padding: 20px; }
        .wb-columns { display: flex; gap: 20px; }
        .wb-column { flex: 1; padding: 15px; }
        .wb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 15px; }
        .wb-heading { font-size: 32px; font-weight: 700; color: #333; }
        .wb-paragraph { font-size: 16px; line-height: 1.6; color: #555 }
        .wb-button { display: inline-block; padding: 12px 28px; background: #4361ee; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .wb-link { color: #4361ee; text-decoration: underline; }
        .wb-divider { border: none; border-top: 1px solid #ddd; margin: 15px 0; }
        .wb-spacer { height: 40px; }
        .wb-hero { text-align: center; padding: 80px 40px; background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; }
        .wb-hero h1 { font-size: 42px; font-weight: 800; margin-bottom: 16px; }
        .wb-hero p { font-size: 18px; opacity: 0.85; margin-bottom: 30px; max-width: 600px; margin-left: auto; }
        .hero-btn { display: inline-block; padding: 14px 36px; background: #4361ee; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; }
        .wb-navbar {display: flex; align-items: center; justify-content: space-between; padding: 14px 30px; background: white; border-bottom: 1px solid #eee; }
        .nav-brand { font-size: 20px; font-weight: 700; color: #333; }
        .nav-links { display: flex; gap: 24px; list-style: none; }
        .nav-links a { color: #555; text-decoration: none; font-size: 14px; font-weight: 500; }
        .wb-footer { padding: 40px 30px; background: #1a1a2e; color: rgba(255,255,255,0.7); text-align: center; font-size: 14px; }
        .wb-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);}
        .card-img { width: 100%; height: 180px; background: #e8e8e8; display: flex; align-items: center; justify-content: center; color: #bbb; }
        .card-body { padding: 20px; }
        .card-body h3 { font-size: 18px; color: #333; margin-bottom: 8px; }
        .card-body p { font-size: 14px; color: #777; line-height: 1.5; }
        .wb-pricing { background: white; border: 2px solid #eee; border-radius: 12px; padding: 30px; text-align: center; }
        .pricing-title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px; }
        .pricing-price { font-size: 42px; font-weight: 800; color: #4361ee; margin-bottom: 20px; }
        .pricing-price span { font-size: 16px; font-weight: 400; color: #999; }
        .pricing-features { list-style: none; margin-bottom: 24px; }
        .pricing-features li { padding: 8px 0; font-size: 14px; color: #555; border-bottom: 1px solid #f0f0f0; }
        .wb-testimonial { background: #f8f9fa; border-radius: 12px; padding: 30px; }
        .testimonial-quote { font-size: 16px; line-height: 1.6; color: #555; font-style: italic; margin-bottom: 16px; }
        .testimonial-author { display: flex; align-items: center; gap: 12px;}
        .testimonial-name { font-weight: 600; font-size: 14px; color: #333; }
        .testimonial-role {font-size: 12px; color: #999; }
        .wb-input, .wb-textarea-el, .wb-select { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; margin: 4px 0; }
        .wb-form { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .wb-checkbox-wrapper { display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .wb-video { width: 100%; background: #000; min-height: 200px; display: flex; align-items: center; justify-content: center; }
        .wb-icon { font-size: 40px; color: #4361ee; text-align: center; padding: 10px }
        .wb-map { width: 100%; height: 250px; background: #e8e8e8; display: flex; align-items: center; justify-content: center; color: #000; }
        .visual-background { pointer-events: none; user-select: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
        .visual-background .wb-background { width: 100%; height: 100%; }
        body > *:not(.visual-background) { position: relative; z-index: 1; }
        `;
}

function formatHTML(html) {
    let formatted = '';
    let indent = 0;
    const tab = '   ';

    html = html.replace(/>\s+</g, '><').trim();
    const tokens = html.split(/(<[^>]+>)/g).filter(t => t.trim());
    tokens.forEach(token => {
        if (token.match(/^<\/\w/)) {
            indent--;
        }
        formatted += tab.repeat(Math.max(0, indent)) + token.trim() + '\n';
        if (token.match(/^<\w[^>]*[^\/]>$/) && !token.match(/^<(img|br|hr|input|meta|link)/i)) {
            indent++;
        }
    });
    return formatted.trim();
}

function downloadZip() {
    if (typeof JSZip === 'undefined') {
        alert('JSZIP non è stato caricato. Controlla la connessione o usa una copia locale della libreria');
        return;
    }
    const zip = new JSZip();
    const cssContent = generateInlineStyles();
    const fullCSS= '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: "Inter", -apple-system, sans-serif; }\nimg { max-width: 100%; height: auto; }\n' + cssContent;
    const htmlContent = generateCleanHTML();
    const htmlFile = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Il mio sito</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
${htmlContent}
<script>
document.querySelectorAll('[data-actions]').forEach(el => {
    el.addEventListener('click', function(e) {
        var actionsRaw = this.dataset.actions;
        if (!actionsRaw) return;
        var actions = [];
        try { actions = JSON.parse(actionsRaw); } catch(e) {}
        actions.forEach(function(action) {
            if (action.type === 'link' && action.value) {
                if (action.newTab) { window.open(action.value, '_blank'); }
                else { window.location.href = action.value; }
            } else if (action.type === 'scroll' && action.value) {
                var target = document.getElementById(action.value);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (action.type === 'show-hide' && action.value) {
                var target = document.getElementById(action.value);
                if (target) {
                    var hidden = target.style.visibility === 'hidden' || target.style.opacity === '0';
                    target.style.transition = 'opacity 0.3s ease';
                    target.style.visibility = hidden ? 'visible' : 'hidden';
                    target.style.opacity = hidden ? '1' : '0';
                    target.style.pointerEvents = hidden ? 'auto' : 'none';
                }
            } else if (action.type === 'submit') {
                var form = this.closest('form');
                if (form) form.submit();
            }
        }.bind(this));
    });
});
<\/script>
</body>
</html>`;
    zip.file('index.html', htmlFile);
    zip.file('style.css', fullCSS);
    zip.generateAsync({ type: 'blob' }).then(function(content) {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sito-web.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement.tagName;
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
            e.preventDefault();
            if (state.selectedElement) deleteElement(state.selectedElement);
        }

        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }

        if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            redo();
        }

        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (state.selectedElement) duplicateElement(state.selectedElement);
        }

        if (e.ctrlKey && e.key === 'c' && !isEditing) {
            if (state.selectedElement) copyElement(state.selectedElement);
        }

        if (e.ctrlKey && e.key === 'v' && !isEditing) {
            pasteElement();
        }

        if (e.key === 'Escape') {
            if (previewModal.classList.contains('visible')) {
                previewModal.classList.remove('visible');
            } else if (exportModal.classList.contains('visible')) {
                exportModal.classList.remove('visible');
            } else if (contextMenu.classList.contains('visible')) {
                hideContextMenu();
            } else {
                deselectElement();
            }
        }

        if(e.altKey && e.key === 'ArrowUp' && state.selectedElement) {
            e.preventDefault();
            moveElement(state.selectedElement, 'up');
        }
        if (e.altKey && e.key === 'ArrowDown' && state.selectedElement) {
            e.preventDefault();
            moveElement(state.selectedElement, 'down');
        }
    });
}

function autoSave() {
    try {
        saveCurrentPage();
        const data = {
            pages: pages,
            currentPageIndex: currentPageIndex,
            currentMode: currentMode,
            counter: state.elementCounter,
            advancedConfig: advancedConfig,
            timestamp: Date.now()
        };
        localStorage.setItem('webbuilder-autosave', JSON.stringify(data));
    } catch (e) {
        console.warn('Autosave fallito:', e);
    }
}

function autoLoad() {
    try {
        const saved = localStorage.getItem('webbuilder-autosave');
        if (!saved) return false;
        const data = JSON.parse(saved);
        if (!data.pages) return false;
        pages = data.pages;
        currentPageIndex = data.currentPageIndex || 0;
        state.elementCounter = data.counter || 0;
        currentMode = data.currentMode || 'structure';
        $$('.mode-btn').forEach(b => b.classList.remove('active'));
        const modeBtn = document.querySelector(`.mode-btn[data-mode="${currentMode}"]`);
        if (modeBtn) modeBtn.classList.add('active');
        if (data.advancedConfig) Object.assign(advancedConfig, data.advancedConfig);
        renderPageTabs();
        loadPage(currentPageIndex);
        return true;
    } catch (e) {
        return false;
    }
}

function initModes() {
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchMode(btn.dataset.mode);    
        });
    });
}

function switchMode(mode) {
    if (currentMode === 'structure') {
        structureHTML = canvas.innerHTML;
    } else {
        freeHTML = canvas.innerHTML;
    }
    saveCurrentPage();
    deselectElement();
    currentMode = mode;
    if (mode === 'free') {
        canvas.classList.add('free-mode');
        $('#freeToolbar').style.display = 'flex';
        if (freeHTML) {
            canvas.innerHTML = freeHTML;
            canvas.querySelectorAll('.builder-element').forEach(el => {
                setupElementEvents(el);
                addResizeHandles(el);
                addFreeDrag(el);
            });
        } else {
            canvas.querySelectorAll('.builder-element').forEach(el => {
                if (!el.closest('.free-toolbar') && !el.classList.contains('resize-handle')) {
                    convertToFreeMode(el);
                }
            });
        }
    } else {
        canvas.classList.remove('free-mode');
        $('#freeToolbar').style.display = 'none';
        if (structureHTML) {
            canvas.innerHTML = structureHTML;
            canvas.querySelectorAll('.builder-element').forEach(el => {
                setupElementEvents(el);
            });
        } else {
            canvas.querySelectorAll('.builder-element').forEach(el => {
                convertToStructureMode(el);
            });
        }
    }
    showCanvasEmpty();
    saveHistory();
}

function convertToFreeMode(el) {
    if (el.dataset.freeX) return;
    const rect = el.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const left = rect.left - canvasRect.left;
    const top = rect.top - canvasRect.top;
    el.dataset.freeX = left;
    el.dataset.freeY = top;
    el.dataset.freeW = rect.width;
    
    el.style.position = 'absolute';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = rect.width + 'px';
    el.style.margin = '0';
    const type = el.dataset.type;
    if (type === 'columns-2' || type === 'columns-3' || type === 'grid' || type === 'section' || type === 'container') {
        el.style.height = rect.height + 'px';
        el.style.overflow = 'visible';
    }
    addResizeHandles(el);
    addFreeDrag(el);
}

function convertToStructureMode(el) {
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.transform = '';
    el.style.margin = '';
    delete el.dataset.freeX;
    delete el.dataset.freeY;
    delete el.dataset.freeW;
    el.querySelectorAll('.resize-handle').forEach(h => h.remove());
}
function addResizeHandles(el) {
    el.querySelectorAll('.resize-handle').forEach(h => h.remove());
    const positions = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-right',
        'bottom-left', 'bottom-center',  'bottom-right'
    ];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handle.dataset.handle = pos;
        el.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(el, pos, e);
        });
    });
}

let autoScrollFrame = null;
let autoScrollPointerY = 0;
function updateAutoScroll(pointerY) {
    autoScrollPointerY = pointerY;
    if (autoScrollFrame) return;
    function step() {
        const area = document.querySelector('.canvas-area');
        if (!area) {
            stopAutoScroll();
            return;
        }
        const rect = area.getBoundingClientRect();
        const edge = 90;
        const speed = 18;
        if (autoScrollPointerY > rect.bottom - edge) {
            area.scrollTop += speed;
        } else if (autoScrollPointerY < rect.top + edge) {
            area.scrollTop -= speed;
        }
        autoScrollFrame = requestAnimationFrame(step);
    }
    autoScrollFrame = requestAnimationFrame(step);
}
function stopAutoScroll() {
    if (autoScrollFrame) {
        cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
    }
}
function initCanvasResize() {
    const heightControl = $('#canvasHeightControl');
    if (!heightControl) return;
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    heightControl.addEventListener('mousedown', (e) => {
        if (currentMode !== 'free') return;
        isDragging = true;
        startY = e.clientY;
        startHeight = canvas.offsetHeight;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        updateAutoScroll(e.clientY);
        const dy = e.clientY - startY;
        const newHeight = Math.max(400, startHeight + dy);
        canvas.style.minHeight = newHeight + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            stopAutoScroll();
            isDragging = false;
            saveHistory();
        }
    });
}
function startResize(el, handle, startEvent) {
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startLeft = parseInt(el.style.left) || 0;
    const startTop = parseInt(el.style.top) || 0;

    function onMouseMove(e) {
        updateAutoScroll(e.clientY);
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        if (handle.includes('right')) {
            newWidth = Math.max(30, startWidth + dx);
        }
        if (handle.includes('left')) {
            newWidth = Math.max(30, startWidth - dx);
            newLeft =  startLeft + dx;
        }
        if (handle.includes('bottom')) {
            newHeight = Math.max(20, startHeight + dy);
        }
        if (handle.includes('top')) {
            newHeight = Math.max(20, startHeight - dy);
            newTop = startTop + dy;
        }

        el.style.width = newWidth + 'px';
        el.style.height = newHeight + 'px';
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        const img = el.querySelector('img');
        if (img) {
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
        }
        const placeholder = el.querySelector('.wb-image-placeholder');
        if (placeholder) {
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
        }
        const innerContent = el.querySelector('.wb-section, .wb-container, .wb-hero, .wb-navbar, .wb-footer, .wb-card, .wb-pricing, .wb-testimonial, .wb-video, .wb-map, .wb-image');
        if (innerContent) {
            innerContent.style.width = '100%';
            innerContent.style.height = '100%';
            const type = el.dataset.type;
            if (type !== 'columns-2' && type !== 'columns-3' && type !== 'grid') {
                innerContent.style.overflow = 'hidden';
            }
        }
        updateFreeToolbarValues(el);
    }
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        stopAutoScroll();
        saveHistory();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}



function addFreeDrag(el) {
    if (el._freeDragBound) return;
    el._freeDragBound = true;
    el.addEventListener('mousedown', function(e) {
        if (currentMode !== 'free') return;
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.closest('.element-actions')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.target.isContentEditable && document.activeElement === e.target) return;
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(el.style.left) || 0;
        const startTop = parseInt(el.style.top) || 0;
        let isDragging = false;
        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!isDragging && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            if (!isDragging) {
                isDragging = true;
                selectElement(el);
                if (!el.style.width || el.style.width === 'auto') {
                    el.style.width = el.offsetWidth + 'px';
                    el.style.height = el.offsetHeight + 'px';
                }
            }
            ev.preventDefault();
            updateAutoScroll(ev.clientY);
            el.style.left = (startLeft + dx) + 'px';
            el.style.top = (startTop + dy) + 'px';
            updateFreeToolbarValues(el);
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            stopAutoScroll();
            if (isDragging) {
                saveHistory();
        }
    }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function initFreeToolbar() {
    $('#ftFontSize').addEventListener('input', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        target.style.fontSize = $('#ftFontSize').value + 'px';
    });

    $('#ftColor').addEventListener('input', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        target.style.color = $('#ftColor').value;
    });

    $('#ftBgColor').addEventListener('input', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        target.style.backgroundColor = $('#ftBgColor').value;
    });

    $('#ftBold').addEventListener('click', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        const current = window.getComputedStyle(target).fontWeight;
        target.style.fontWeight = (current === '700' || current === 'bold') ? '400' : '700';
        $('#ftBold').classList.toggle('active');
    });

    $('#ftItalic').addEventListener('click', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        const current = window.getComputedStyle(target).fontStyle;
        target.style.fontStyle = current === 'italic' ? 'normal' : 'italic';
        $('#ftItalic').classList.toggle('active');
    });

    ['Left', 'Center', 'Right'].forEach(align => {
        $(`#ftAlign${align}`).addEventListener('click', () => {
            if (!state.selectedElement) return;
            const target= getStyleTarget(state.selectedElement);
            target.style.textAlign = align.toLowerCase();
            ['Left', 'Center', 'Right'].forEach(a => {
                $(`#ftAlign${a}`).classList.remove('active');
            });
            $(`#ftAlign${align}`).classList.add('active');
        });
    });
    $('#ftWidth').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.width = $('#ftWidth').value + 'px';
    });

    $('#ftHeight').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.height = $('#ftHeight').value + 'px';    
    });

    $('#ftPosX').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.left = $('#ftPosX').value + 'px';
    });

    $('#ftPosY').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.top = $('#ftPosY').value + 'px';
    });

    $('#ftRotation').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.transform = `rotate(${$('#ftRotation').value}deg)`;
    });

    $('#ftOpacity').addEventListener('input', () => {
        if (!state.selectedElement) return;
        state.selectedElement.style.opacity =$('#ftOpacity').value / 100;
    });

    $('#ftBorderRadius').addEventListener('input', () => {
        if (!state.selectedElement) return;
        const target = getStyleTarget(state.selectedElement);
        target.style.borderRadius = $('#ftBorderRadius').value + 'px';
    });

    $('#ftDelete').addEventListener('click', () => {
        if (state.selectedElement) deleteElement(state.selectedElement);
    });
}

function updateFreeToolbarValues(el) {
    if (!el) return;
    const target = getStyleTarget(el);
    const computed = window.getComputedStyle(target);
    $('#ftFontSize').value = parseInt(computed.fontSize) || '';
    $('#ftColor').value = rgbToHex(computed.color);
    $('#ftBgColor').value = rgbToHex(computed.backgroundColor);
    $('#ftWidth').value = parseInt(el.style.width) || el.offsetWidth;
    $('#ftHeight').value = parseInt(el.style.height) || el.offsetHeight;
    $('#ftPosX').value = parseInt(el.style.left) || 0;
    $('#ftPosY').value = parseInt(el.style.top) || 0;

    const transform = el.style.transform || '';
    const rotateMatch = transform.match(/rotate\((-?\d+)deg\)/);
    $('#ftRotation').value = rotateMatch ? rotateMatch[1] : 0;
    $('#ftOpacity').value = Math.round(parseFloat(computed.opacity) * 100);
    $('#ftBorderRadius').value = parseInt(computed.borderRadius) || 0;
    const fw = computed.fontWeight;
    $('#ftBold').classList.toggle('active', fw === '700' || fw === 'bold');
    $('#ftItalic').classList.toggle('active', computed.fontStyle === 'italic');
    ['Left', 'Center', 'Right'].forEach(a => {
        $(`#ftAlign${a}`).classList.toggle('active', computed.textAlign === a.toLowerCase());
    });
}

function initPages() {
    $('#btnAddPage').addEventListener('click', addPage);
    renderPageTabs();
}
function addPage() {
    saveCurrentPage();
    const pageNum = pages.length + 1;
    pages.push({
        name: 'Pagina ' + pageNum,
        structureHTML: '',
        freeHTML: ''
    });
    currentPageIndex = pages.length - 1;
    loadPage(currentPageIndex);
    renderPageTabs();
}
    function saveCurrentPage() {
        if (currentMode === 'structure') {
            pages[currentPageIndex].structureHTML = canvas.innerHTML;
            pages[currentPageIndex].freeHTML = freeHTML;
        } else {
            pages[currentPageIndex].freeHTML = canvas.innerHTML;
            pages[currentPageIndex].structureHTML = structureHTML;
        }
    }
function loadPage(index) {
    currentPageIndex = index;
    structureHTML = pages[index].structureHTML;
    freeHTML = pages[index].freeHTML;
    if (currentMode === 'structure') {
        canvas.classList.remove('free-mode');
        $('#freeToolbar').style.display = 'none';
        if (structureHTML) {
            canvas.innerHTML = structureHTML;
        } else {
            canvas.innerHTML = '<div class="canvas-empty"><i class="fa-solid fa-plus-circle"></i><p>Trascina un elemento qui per iniziare</p><p class="hint">oppure scegli un blocco pronto dal pannello a sinistra</p></div>';
        }
    } else {
        canvas.classList.add('free-mode');
        $('#freeToolbar').style.display = 'flex';
        if (freeHTML) {
            canvas.innerHTML = freeHTML;
        } else {
            canvas.innerHTML = '<div class="canvas-empty"><i class="fa-solid fa-plus-circle"></i><p>Trascina un elemento qui per iniziare</p><p class="hint">oppure scegli un blocco pronto dal pannello a sinistra</p></div>';
        }
    }
        canvas.querySelectorAll('.builder-element').forEach(el => {
            setupElementEvents(el);
            if (currentMode === 'free') {
                addResizeHandles(el);
                addFreeDrag(el);
            }
        });
        deselectElement();
        showCanvasEmpty();
        state.history = [];
        state.historyIndex = -1;
        saveHistory();
        updateLayers();
    }
function deletePage(index) {
    if (pages.length <= 1) return;
    if (!confirm('Eliminare "' + pages[index].name + '"?')) return;
    pages.splice(index, 1);
    if (currentPageIndex >= pages.length) {
        currentPageIndex = pages.length - 1;
    }
    loadPage(currentPageIndex);
    renderPageTabs();
}
function renamePage(index) {
    const tab= $$('.page-tab')[index];
    if (!tab) return;
    const currentName = pages[index].name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'page-rename-input';
    input.value = currentName;
    tab.textContent = '';
    tab.appendChild(input);
    input.focus();
    input.select();
    function finishRename() {
        const newName = input.value.trim() || currentName;
        pages[index].name = newName;
        autoSave();
        renderPageTabs();
    }
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
            input.value = currentName;
            input.blur();
        }
    });
}
function renderPageTabs() {
    const container = $('#pagesTabs');
    container.innerHTML = '';
    pages.forEach((page, i) => {
        const tab = document.createElement('button');
        tab.className = 'page-tab' + (i === currentPageIndex ? ' active' : '');
        tab.dataset.page = i;
        tab.textContent = page.name;
        if (pages.length > 1) {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'page-close';
            closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePage(i);
            });
            tab.appendChild(closeBtn);
        }
        tab.addEventListener('click', () => {
            if (i === currentPageIndex) return;
            saveCurrentPage();
            loadPage(i);
            renderPageTabs();
        });
        tab.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            renamePage(i);
        });
        container.appendChild(tab);
    });
}
function observeAnimation(target, anim, speed) {
    if (target._animObserver) target._animObserver.disconnect();
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                target.classList.remove('animate__animated', 'animate__' + anim);
                void target.offsetWidth;
                target.style.setProperty('animation-duration', speed, 'important');
                target.style.animationFillMode = 'both';
                target.classList.add('animate__animated', 'animate__' + anim);
                observer.disconnect();
            }
        });
    }, { threshold: 0.15 });
    observer.observe(target);
    target._animObserver = observer;
}
function initPlatformWarning() {
    const banner = document.getElementById('platformWarning');
    const closeBtn = document.getElementById('platformWarningClose');
    if (!banner || !closeBtn) return;
    const isSmallScreen = window.innerWidth < 1024;
    const dismissed = sessionStorage.getItem('platform-warning-dismissed');
    if (isSmallScreen && !dismissed) {
        banner.classList.add('visible');
        setTimeout(() => {
            const h = banner.offsetHeight;
            document.documentElement.style.setProperty('--warning-banner-height', h + 'px');
            document.body.classList.add('has-platform-warning');
        }, 100);
    }
    closeBtn.addEventListener('click', () => {
        banner.classList.remove('visible');
        document.body.classList.remove('has-platform-warning');
        sessionStorage.setItem('platform-warning-dismissed', 'true');
    });
}
function initFunctions() {
    const functionsModal = $('#functionsModal');
    const btnFunctions = $('#btnFunctions');
    const closeFunctions = $('#closeFunctions');
    btnFunctions.addEventListener('click', () => {
        functionsModal.classList.add('visible');
        populateFormSelects();
    });
    closeFunctions.addEventListener('click', () => {
        functionsModal.classList.remove('visible');
    });
    functionsModal.addEventListener('click', (e) => {
        if (e.target === functionsModal) functionsModal.classList.remove('visible');
    });
    $$('.fn-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.fn-menu-item').forEach(i => i.classList.remove('active'));
            $$('.fn-panel').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            const panel = $('#fn-' + item.dataset.fn);
            if (panel) panel.classList.add('active');
        });
    });
    $('#btnSaveFormspree').addEventListener('click', saveFormspree);
    $('#btnSaveSheets').addEventListener('click', saveSheets);
    $('#btnSaveAuth').addEventListener('click', saveAuth);
    loadFunctionSettings();
    initAdvancedFunctions();
}
function populateFormSelects() {
    const forms = canvas.querySelectorAll('.builder-element[data-type="form"], .builder-element[data-type="form-contact"]');
    const selects = [
        $('#formSelect'),
        $('#formSelectSheets')
    ];
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Seleziona un modulo --</option>';
        forms.forEach((form, i) => {
            const id = form.id || form.dataset.id || ('form-' + i);
            const label = form.dataset.label || ('Modulo ' + (i + 1));
            const option = document.createElement('option');
            option.value = id;
            option.textContent = label;
            select.appendChild(option);
        });
        if (currentVal) select.value = currentVal;
    });
}
function saveFormspree() {
    const url = $('#formspreeUrl').value.trim();
    const msg = $('#formSuccessMsg').value.trim();
    const formId = $('#formSelect').value;
    const status = $('#formspreeStatus');
    if (!url) {
        showFnStatus(status, 'Inserisci il link Formspree!', 'error');
        return;
    }
    if (!url.includes('formspree.io')) {
        showFnStatus(status, 'Il link deve essere di formspree.io', 'error');
        return;
    }
    if (!formId) {
        showFnStatus(status, 'Seleziona un modulo dal canvas!', 'error');
        return;
    }
    const formEl = canvas.querySelector('.builder-element[data-id="' + formId + '"]') ||
                   canvas.querySelector('#' + formId);

    if (!formEl) {
        showFnStatus(status, 'Modulo non trovato nel canvas!', 'error');
        return;
    }
    formEl.dataset.formspreeUrl = url;
    formEl.dataset.formSuccessMsg = msg || 'Grazie! Ti risponderemo presto.';
    formEl.dataset.formMultiple = $('#formMultipleSubmit').checked ? 'true' : 'false';
    saveFunctionSettings();
    saveHistory();
    showFnStatus(status, 'Collegamento salvato! Il modulo ora invierà email.', 'success');
}
function saveSheets() {
    const url = $('#sheetsUrl').value.trim();
    const formId = $('#formSelectSheets').value;
    const status = $('#sheetsStatus');
    if (!url) {
        showFnStatus(status, 'Inserisci il link Sheet.best!', 'error');
        return;
    }
    if (!formId)  {
        showFnStatus(status, 'Seleziona un modulo del canvas!', 'error');
        return;
    }
    const formEl = canvas.querySelector('.builder-element[data-id="' + formId + '"]') ||
                   canvas.querySelector('#' + formId);
    if (!formEl) {
        showFnStatus(status, 'Modulo non trovato nel canvas!', 'error');
        return;
    }
    formEl.dataset.sheetsUrl = url;
    saveFunctionSettings();
    saveHistory();
    showFnStatus(status, 'Collegamento salvato! I dati verranno salvati in Google Sheets.', 'success');
}
function showFnStatus(el, message, type) {
    if (!el) return;
    el.style.display = 'block';
    el.textContent = message;
    el.style.background = type === 'success' ? 'rgba(46,196,182,0.15)' : 'rgba(230,57,70,0.15)';
    el.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    setTimeout(() => {
        el.style.display = 'none';
    }, 4000);
}
function saveFunctionSettings() {
    const settings = {
        formspreeUrl: $('#formspreeUrl').value,
        formSuccessMsg: $('#formSuccessMsg').value,
        formSelect: $('#formSelect').value,
        formMultipleSubmit: $('#formMultipleSubmit').checked,
        sheetsUrl: $('#sheetsUrl').value,
        formSelectSheets: $('#formSelectSheets').value,
        supabaseUrl: $('#supabaseUrl').value,
        supabaseKey: $('#supabaseKey').value,
        authLogin: $('#authLogin').checked,
        authRegister: $('#authRegister').checked,
        authLogout: $('#authLogout').checked
    };
    localStorage.setItem('webbuilder-functions', JSON.stringify(settings));
}
function loadFunctionSettings() {
    try {
        const saved = localStorage.getItem('webbuilder-functions');
        if (!saved) return;
        const settings = JSON.parse(saved);
        if (settings.formspreeUrl) $('#formspreeUrl').value = settings.formspreeUrl;
        if (settings.formSuccessMsg) $('#formSuccessMsg').value = settings.formSuccessMsg;
        if (settings.formMultipleSubmit !== undefined) $('#formMultipleSubmit').checked = settings.formMultipleSubmit;
        if (settings.sheetsUrl) $('#sheetsUrl').value = settings.sheetsUrl;
        if (settings.supabaseUrl) $('#supabaseUrl').value = settings.supabaseUrl;
        if (settings.supabaseKey) $('#supabaseKey').value = settings.supabaseKey;
        if (settings.authLogin !== undefined) $('#authLogin').checked = settings.authLogin;
        if (settings.authRegister !== undefined) $('#authRegister').checked = settings.authRegister;
        if (settings.authLogout !== undefined) $('#authLogout').checked = settings.authLogout;
    } catch (e) {}
}
function saveAuth() {
    const url = $('#supabaseUrl').value.trim();
    const key = $('#supabaseKey').value.trim();
    const status = $('#authStatus');
    if (!url) {
        showFnStatus(status, 'Inserisci il Supabase Project URL!', 'error');
        return;
    }
    if (!url.includes('supabase.co')) {
        showFnStatus(status, 'Il link deve essere di supabase.co', 'error');
        return;
    }
    if (!key) {
        showFnStatus(status, 'Inserisci la Supabase Anon Key!', 'error');
        return;
    }
    saveFunctionSettings();
    showFnStatus(status, 'Login attivato! Verrà incluso quando esporti il sito.', 'success');
}

function initAdvancedFunctions() {
    const SQL = `-- =====================================================
-- WebBuilder Advanced User System - Database Setup
-- Esegui nell'SQL Editor di Supabase (una sola volta)
-- =====================================================

CREATE TABLE IF NOT EXISTS wb_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wb_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  image_url TEXT,
  category TEXT DEFAULT 'Generale',
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wb_user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  key TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS wb_user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

ALTER TABLE wb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profili pubblici" ON wb_profiles;
CREATE POLICY "Profili pubblici" ON wb_profiles FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Utente modifica proprio profilo" ON wb_profiles;
CREATE POLICY "Utente modifica proprio profilo" ON wb_profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Post pubblicati visibili" ON wb_posts;
CREATE POLICY "Post pubblicati visibili" ON wb_posts FOR SELECT USING (published = TRUE);
DROP POLICY IF EXISTS "Autore gestisce propri post" ON wb_posts;
CREATE POLICY "Autore gestisce propri post" ON wb_posts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Progressi visibili per classifica" ON wb_user_progress;
CREATE POLICY "Progressi visibili per la classifica" ON wb_user_progress FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Utente gestisce propri progressi" ON wb_user_progress;
CREATE POLICY "Utente gestisce propri progressi" ON wb_user_progress FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dati privati utente" ON wb_user_data;
CREATE POLICY "Dati privati utente" ON wb_user_data FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS wb_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    price NUMERIC(10,2) DEFAULT 0,
    image_url TEXT,
    category TEXT DEFAULT 'Generale',
    stock INEGER DEFAULT -1,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wb_products ENABLE ROW LEVEL SECURITY;
DROP POLICCY IF EXISTS "Prodotti pubblicati visibili" ON wb_products;
CREATE POLICY "Prodotti pubblicati visibili" ON wb_products FOR SELECT USING (published = TRUE);
DROP POLICY IF EXISTS "Admin gestisce prodotti" ON wb_products;
CREATE POLICY "Admin gestisce prodotti" ON wb_products FOR ALL USING (
    EXISTS (SELECT 1 FROM wb_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE ID NO EXISTS wb_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    name TEXT, email TEXT, service TEXT,
    booking_data DATE, booking_time TEXT,
    notes TEXT, status TEXT DEFAUL 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wb_booking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chiunque può creare prenotazione" ON wb_bookings;
CREATE POLICY "Chiunque può creare prenotazione" ON wb_bookings FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Utente vede proprie prenotazioni" ON wb_bookings;
CREATE POLICY "Utente vede proprie prenotazioni" ON wb_bookings FOR SELECT USING (auth.uid() = user_id OR TRUE);
DROP POLICY "Admin gestisce prenotazioni" ON wb_bookings FOR ALL USING (
    EXISTS (SELECT 1 FROM wb_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS wb_newsletter (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);
ALTER TABLE wb_newsletter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chiunque può iscriversi" ON wb_newsletter;
CREATE POLICY "Chiunque puà iscriversi" ON wb_profiles FOR INSER WIH CHECK (TRUE);
DROP POLICY IF EXISTS "Utente gestisce propria iscrizione" ON wb_newsletter;
CREATE POLICY "Utente gestisce propria iscrizione" ON wb_newsletter FOR ALL USING (email = (SELECT email FROM auth.users WHERE id = auth.id()));
DROP POLICY IF EXISTS "Admin vede iscritti" ON wb_newsletter;
CREATE POLICY "Admin vede iscritti" ON wb_newsletters FOR SELECT USING (
    EXISTS (SELECT 1 FROM wb_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wb_profiles (id, username, role)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;
    
    const sqlEl = $('#dbSetupSQL');
    if (sqlEl) sqlEl.textContent = SQL;

    $('#btnCopySQL')?.addEventListener('click', function() {
        function showCopied() {
            const btn = $('#btnCopySQL');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
        if (navigator.clipboard) navigator.clipboard.writeText(SQL).then(showCopied).catch(() => fallbackCopy(SQL, showCopied));
        else fallbackCopy(SQL, showCopied);
    });
    $('#btnSaveRoles')?.addEventListener('click', function() {
        const roles = ($('#rolesConfig').value || 'user\nadmin').split('\n').map(r => r.trim()).filter(r => r);
        advancedConfig.roles = roles;
        advancedConfig.defaultRole = $('#defaultUserRole').value;
        advancedConfig.blogPublishRole = $('#blogPublishRole').value;
        advancedConfig.blogModerateRole = $('#blogModerateRole').value;
        saveAdvancedConfig();
        updateRoleSelects();
        showFnStatus($('#rolesStatus'), ' Ruoli salvati!', 'success');
    });
    $('#btnUpdateRoleSelects')?.addEventListener('click', updateRoleSelects);
    $('#btnSaveBlog')?.addEventListener('click', function() {
        advancedConfig.blogEnabled = $('#blogEnabled').checked;
        advancedConfig.blogPostsPerPage = parseInt($('#blogPostsPerPage').value) || 10;
        advancedConfig.blogModeration = $('#blogModeration').value;
        advancedConfig.blogCategories = ($('#blogCategories').value || '').split('\n').map(c => c.trim()).filter(c => c);
        saveAdvancedConfig();
        showFnStatus($('#blogStatus'), ' Configurazione blog salvata!', 'success');
    });
    $('#btnSaveProducts')?.addEvenListener('click', function() {
        advancedConfig.productCurrency = $('#productCurrency').value;
        advancedConfig.addToCartText = $('#productAddToCartText').value;
        advancedConfig.cartEmptyText = $('#productCartEmpty').value;
        saveAdvancedConfig();
        showFnStatus($('#productsStatus'), ' Impostazioni prodoti salvate!', 'success')
    });
    $('#btnSaveBookings')?.addEventListener('click', function() {
        advancedConfig.bookingServices = ($('#bookingServices').value || '').split('\n').map(s => s.trim()).filter(s => s);
        advancedConfig.bookingTimes = ($('#bookingTimes').value || '').split(',').map(t => t.trim()).filter(t => t);
        advancedConfig.bookingSuccessMsg = $('#bookingSuccessMsg').value;
        advancedConfig.bookingRequireLogin = $('#bookingRequireLogin').checked;
        saveAdvancedConfig();
        showFnStatus($('#bookingsStatus'), ' Impostazioni prenotazioni salvate!', 'success');
    });
    $('#btnSavePaymens')?.addEventListener('click', function() {
        advancedConfig.stripeKey = $('#stripeKey').value;
        advancedConfig.paypalClientId = $('#paypalClientId').value;
        advancedConfig.paymentCurrency = $('#paymentCurrency').value;
        saveAdvancedConfig();
        showFnStatus($('#paymentsStatus'), ' Impostazioni pagamenti salvate!', 'success');
    });
    $('#btnSaveNewsletter')?.addEventListener('click', function() {
        advancedConfig.newsletterSuccessMsg = $('#newsletterSuccessMsg').value;
        saveAdvancedConfig();
        showFnStatus($('#newsletterStatus'), ' Impostazioni newsletter salvate!', 'success');
    });
    if (advancedConfig.stripeKey && $('#stripeKey')) $('#stripeKey').value = advancedConfig.stripeKey;
    if (advancedConfig.paypalClientId && $('#paypalClientId')) $('#paypalClientId').value = advancedConfig.paypalClientId;
    if (advancedConfig.paymentCurrency && $('#paymentCurrency')) $('#paymentCurrency').value = advancedConfig.paymentCurrency;
    if (advancedConfig.newsletterSuccessMsg && $('#newsletterSuccessMsg')) $('#newsletterSuccessMsg').value = advancedConfig.newsletterSuccessMsg;
    if (advancedConfig.bookingSuccessMsg && $('#bookingSuccessMsg')) $('#bookingSuccessMsg').value = advancedConfig.bookingSuccessMsg;
    if (advancedConfig.bookingServices && $('#bookingServices')) $('#bookingServices').value = advancedConfig.bookingServices.join('\n');
    if (advancedConfig.bookingTimes && $('#bookingTimes')) $('#bookingTimes').value = advancedConfig.bookingTimes.join(', ');

    loadAdvancedConfig();
    updateRoleSelects();
}
function updateRoleSelects() {
    const roles = advancedConfig.roles || ['user', 'premium', 'moderator', 'admin'];
    if ($('#rolesConfig')) $('#rolesConfig').value = roles.join('\n');
    ['defaultUserRole', 'blogPublishRole', 'blogModerateRole', 'propRequireRole', 'propRoleGateRole'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = roles.map(r => `<option value="${r}">${r}</option>`).join('');
          if (roles.includes(cur)) sel.value = cur;  
    });
}
function saveAdvancedConfig() {
    try {
        localStorage.setItem('webbuilder-advanced', JSON.stringify(advancedConfig));
    } catch(e) {}
}

function loadAdvancedConfig() {
    try {
        const saved = localStorage.getItem('webbuilder-advanced');
        if (!saved) return;
        Object.assign(advancedConfig, JSON.parse(saved));
        if ($('#rolesConfig')) $('#rolesConfig').value = advancedConfig.roles.join('\n');
        if ($('#blogEnabled')) $('#blogEnabled').checked = advancedConfig.blogEnabled;
        if ($('#blogPostsPerPage')) $('#blogPostsPerPage').value = advancedConfig.blogPostsPerPage;
        if ($('#blogModeration')) $('#blogModeration').value = advancedConfig.blogModeration;
        if ($('#blogCategories')) $('#blogCategories').value = (advancedConfig.blogCategories || []).join('\n');
        if ($('#blogPublishRole')) $('#blogPublishRole').value = advancedConfig.blogPublishRole;
        if ($('#blogModerateRole')) $('#blogModerateRole').value = advancedConfig.blogModerateRole;
        if ($('#defaultUserRole')) $('#defaultUserRole').value = advancedConfig.defaultRole;
    } catch(e) {}
}