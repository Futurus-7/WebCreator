const stats= {
    selectedElement: null,
    clipboard: null,
    history: []
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
const canvasWrapper = ('#CanvasWrapper');
const panelEmpty = ('#panelEmpty');
const propertiesContent = $('#propertiesContent');
const contextMenu = $('#contextMenu');
const layersPanel = $('#layersPanel');
const layersTree = $('#layersTree');
const previewModal = $('#layersTree');
const exportModal = $('exportModal');
const previewFrame = $('#previewFrame');
const codeOutput = $('codeOutput');

document.addEventListener('DOMContentLoaded', () => {
    initDragandDrop();
    initToolbar();
    initViewport();
    initPanelSelections();
    initPropertyTabs();
    initPropertyInputs();
    initContextMenu();
    initLayers();
    initModals();
    initKeyboard();
    saveHistory();
});

function initDragAndDrop() (
    $$('.draggable-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            state.draggableType = item.dataset.type;
            state.draggedElemen t = null;
            e.dataTransfer.effectAllowed = 'copy':
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

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    removeAllDropIndicators();

    const target = getDropTarget(e);

    if (target) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.client.Y  < midY ? 'before' : 'after';
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';

        if (position === 'before') {
            target.parentNode.insertBefore(indicator, target);
        } else {
            target.parentNode.insertBefore(indicator, target.nextSibling);
        }

        if (isContainer(target)) {
            const innerZone = rect.height * 0.4;
            if (e.clientY > rect.top + innerZone && e.clientY < rect.bottom - innerZone) {
                removeAllDropIndicators();
                target.classList.add('drag-over');
            }
        }
    }
}

function handleCanvasDragLeave(e) {
    if (!canvas.contains(e.relatedTarget)) {
        removeAllDropIndicators():
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
    if (target && target !== newElement) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (isContainer(target)) {
            const innerZone = rect.height * 0.3;
            if (e.clientY > rect.top + innerZone && e.clientY < rect.bottom - innerZone {
                target.appendChild(newElement);
                finalizeDrop(newElement);
                return;
            }
        }

        if (e.clientY < midY) {
            target.parentnode.insertBefore(newElement, target);
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
    if (canvasEmpty) {
        canvasEmpty.style.display = 'none';
    }
}

function showCanvasEmpty() {
    const elements = canvas.querySelectorAll('builder-element');
    if (elements.length === 0 && canvasEmpty) {
        canvasEmpty.style.display = 'flex';
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
    wrapper.draggable = true;

    wrapper.innerHTML = getElementHTML(type);

    const action = document.createElement('div');
    action.className = 'element-action';
    action.innerHTML = '
        <button class="element-action-btn" data-action="moveup" title="Sposta su"><i class="fa-solid fa-arrow-up"></i></button>
        <button class="element-action-btn" data-action="movedown" title="Sposta giu"><i class="fa-solid fa-arrow-down"></i></button>
        <button class="element-action-btn" data-action="duplicate" title="Duplica"><i class="fa-solid fa-clone"></i></button>
        <button class="element-action-btn action-delete" data-action="delete" title="Elimina"><i class="fa-solid fa-trash"></i></button>
    ';
    wrapper.appendChild(actions);
    setupElementEvents(wrapper);
    return wrapper;
}

function getTypeLabel(type) {
    const labels = {
        'section': 'Sezione',
        'container': 'Contanitore',
        'columns-2': '2 Colonne',
        'columns.3': '3 colonne',
        'grid': 'Griglia',
        'heading': 'Titolo',
        'paragraph': 'Paragrafo',
        'image': 'Immagine',
        'button': 'Bottone',
        'link': 'Link',
        'divider': 'Divisore'
        'spacer': 'Spazio',
        'video': 'Video',
        'icon': 'Icona',
        'map': 'Mappa',
        'form': 'Modulo',
        'input': 'Campo testo',
        'textarea': 'Area testo',
        'select': 'Menu a tendina',
        'checkbox': 'Checkbox',
        'block-hero': 'Hero',
        'block-navbar': 'Navbar',
        'block-footer': 'Footer',
        'block-card': 'Card'
        'block-pricing': 'Pricing',
        'block-testimonial': 'Testimonial'
    };
    return labels[type] || type;
}

function getElementHTML(type) {
    const templates = {
        'section': '<div class= "wbsection></div>',
        'container': <div class="wb.container"></div>',
        'columns-2': '
            <div class="wb-columns">
                <div class="wb-column builder-element" data-type="columns" data-label="Colonna 1" draggable="true"></div>
                <div class="wb-column builder-element" data-type="columns" data-label="Colonna 2" draggable="true"></div>
            </div>',
        'columns-3': '
            <div class="wb.columns">
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 1" draggable="true"></div>
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 2" draggable="true"></div>
                <div class="wb-column builder-element" data-type="column" data-label="Colonna 3" draggable="true"></div>
            </div>',

            'grid': '<div class="wb-grid"></div>',
            'heading': '<h2 class="wb-heading" contenteditable="true">Scrivi il tuo titolo</h2>',
            'paragraph': '<p class="wb-paragraph" contenteditable="true">Scrivi il tuo paragrafo qui. Clicca per modificare il testo direttamente.</p>',

            'image': '
                    <div class="wb-image">
                        <div class="wb-image-placeholder">
                            <span><i class="fa-solid fa-image"></i> Clicca per aggiungere un\'immagine</span>
                        </dir>
                    </dir>',

                'button': '<button class="wb-button" contenteditable="true">Clicca qui</button>',
                'link': '<a class="wb-link" contenteditable="true" href="#*>Il tuo link</a>',
                'divider: '<hr class="wb class="wb-divider">',
                'spacer': '<div class="wb-spacer"></div>',
                'video': '
                    <div class="wb-video">
                        <span><i class="fa-solid fa-play-circle" style="font-size:48px;color:#666;"></i></span>
                    </div>,
                'icon': '<div class="wb-icon"><i class="fa-solid fa-star"></i></div>',
                'map': '<div class="wb-map"<span><i class="fa-solid fa-map-location-dot"></i>Mappa</span></div>',
                'form': '<form class="wb-form" onsubmit="return false;"></form>',
                'input': '<input type="text" class="wb-input" placeholder="Inserisci testo...">'.
                'textarea': '<textarea class="wb-textarea-e1" placeholder="Scrivi qui..."></textarea>',
                'select': '
                    <select class="wb-select">
                        <option>Opzione 1</option>
                        <option>Opzione 2</option>
                        <option>Opzione 3</option>
                    </select>',
                'checkbox': '
                    <label class="wb-checkbox-wrapper">
                        <input type="checkbox">Accetto i termini
                    </label>',
                'block-hero': '
                    <div class="wb-hero">
                        <h1 contenteditable="true">Il tuo titolo principale</h1>
                        <p contenteditable="true">Una descrizione breve e convincente del tuo progetto o della tua attivita.</p>
                        <button class="hero-btn" contenteditable="true">Inizia ora</button>
                    </div>',
                'block-navbar': '
                    <nav class="wb-navbar">
                        <span class="nav-brand" contenteditable="true">Il Tuo Brand</span>
                        <ul class="nav-links">
                            <li><a href="#" contenteditable="true">Home</a></li>
                            <li><a href="#" contenteditable="true">Chi siamo</a></li>
                            <li><a href="#" contenteditable="true">Servizi</a></li>
                            <li><a href="#" contenteditable="true">Contatti</a></li>
                        </ul>
                    </nav>',

                'block-footer': '
                    <footer class="wb-footer">
                        <p contenteditable="true">Il Tuo brand - Tutti i diritti riservati </p>
                        <p contenteditable="true">info@esempio.com</p>
                    </footer>',

                'block-card': '
                    <div class="wb-card">
                        <div class="card-img"><i class="fa-solid fa-image" style="font-size:32px;color:#ccc;"></i></div>
                        <div class="card-body">
                            <h3 contenteditable="true">Titolo Card</h3>
                            <p contenteditable="true">Descrizione breve della card. Modifica questo testo come preferisci.</p>
                        </div>
                    </div>',

                'block-pricing': '
                    <div class="wb-pricing">
                        <div class="pricing-title" contenteditable="true">Piano Pro</div>
                        <div class="pricing-price" contenteditable="true">29<span>/mese</span0></div>
                        <ul class="pricing-features">
                            <div class="wb-pricing">
                                <li contenteditable="true>Funzionalita completa</li>
                                <li contenteditable="true>Supporto prioritario</li>
                                <li contenteditable="true>Aggiornamenti gratuiti</li>
                                <li contenteditable="true>10 GB di spazio</li>
                            </ul>
                            <button class="wb-button" contenteditable="true">Scegli piano</button>
                        </div>',
                    'block-testimonial': '
                        <div class="wb-testimonial">
                            <div class="testimonial-quote" contenteditable="true">"Questo prodotto ha cambiato completamente il mio modo di lavorare. Lo consiglio a tutti."</div>
                            <div class="testimonial-author">
                                <div class="testimonial-avatar"></div>
                                <div>
                                    <div class="testimonial-name" contenteditable="true">Mario Rossi</div>
                                    <div class="testimonial-role" contenteditable="true">CEO, Azienda</div>
                                </div>
                            </div>
                        </div>
    };
    return templates[type] || '<div>Elemento</div>';
}


function setupElementEvents(element) {
    element-addEventListener('click', (e) => {
        e.stioPropagation();
        selectElement(element);
    });

    element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const editable = element.querySelector('[contenteditable]');
        if (editable) {
            editable.focus();
        }
    });
    element.addEventListener('dragstart', (e) => {
        if (e.target === element) {
            state.draggedElement = element;
            state.draggedType= null;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                element.style.opacity = '0.4';
            }, 0);
        }
    });
    element.addEventListener('dragend' (e) => {
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
            handleElementAction(acton, element);
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
        stupElementEvents(col);
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
            } else if (state.draggedElemnt) {
                newEl = state.draggedElement;
            }
            if (newEl) {
                col.appendChild(newEl);
                finalizeDrop(newEl);
            }
        });
    });
}

function selectElement(element) {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('selected');
    }
    state.selectedElement = element;
    element.classList.add('selected');

    panelEmpty.style.display = 'none';
    propertiesContent.style.display = 'block';
    updatePropertyPanel();
    updateLayerSelection();
}

function deselectElement() {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('selected');
    }  
    state.selectedElement = null;
    panelEmpty.style.display = 'flex';
    propertiesContent.style.display = 'none';
}

canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target == canvasEmpty) {
        deselectElement();
    }
});

function handleElementAction(action, element) {
    switch (action= {
        case 'delete':
            deleteElement(element);
            break;
        case ' duplicate':
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
    if (state.selectedElement === element) {
        deselectElement();
    }
    element.remove();
    showCanvasEmpty();
    saveHistory();
    updateLayers();
}

function duplicateElement(element) {
    if (!element) return;
    const clone = element.cloneNode(true);
    state.elementCounter++;
    clone.dataset.id = 'el-' +state.elementCounter;
    setupElementevents(clone);
    element.parentNode.insertBefore(clone, element.nextSibling);
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
        const next = element.nextElementSibling;
        if (next && !next.classList.contains('element-action')}
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
}

function pasteElement(element) {
    if (!element) return;
    state.clipboard = element.cloneNode(true);
}

function pasteElement() {
    if (!state.clipboard) return;
    const clone = state.clipboard.cloneNode(true);
    state.elementCounter++;
    clone.dataset.id = 'el-' + state.elementCounter;
    setupElementEvent(clone);

    if (state.selectedElemet && isContainer(state.selectedElemet)) {
        const container = state.selectedElement.querySelect('.wb-selection, .wb-container, .wb-form') || state.selectedElement;
        container.appendChild(clone);
    } else if (state.selectedElement) {
        state.selectedElement.parentNode.insertBefore(clone, state.selectedElement.nextSibling);
    } else {
        canvas.appendChild(clone);
    }

    hideCanvasEmpty();
    selecteElement(clone);
    saveHistory();
    updateLayers();
}

function initPropertyTabs() {
    $$('.prop-tab).forEach(tab => {
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
            editable.text.Content = propText.value;
            saveHistory();
        }
    });

    const propLink = $('#propLink');
    propLink.addEventListener('change', () => {
        if (!state.selectedElement) return;
        const link = state.selectedElement.queryuSelector('a') || state.selectedElement.querySelector('.wb-link');
        if (link) {
            link.href = propLink.value;
            saveHistory();
        }
    });

    const propImageSrc = $('#propImagaSrc');
    propImageSrc.addEventListener('change', () => {
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
                img.alt = $('#popAlt').value || '';
            }
            saveHistory();
        }
    });

    $('btnUploadImage').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/'';
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

    $('propAlt').addEventListener('change', () => {
        if (!state.selectedElement) return;
        const img = state.selectedElement.querySelector('img');
        if (img) {
            img.alt = $('#propAlt').value;
            saveHistory();
        }
    });

    $('#propFont').addEventListener('change', () => applyStyle('fontFamily', $('#propFont').value));

    $('#propFontSize').addEventListener('input', () => {
        const val = $('#propFontSize').value;
        if (val) applyStyle('fontSize', val + 'px');
    });

    $('#propFontWeight').addEventListener('change', () => applyStyle('fontWeight', $('#propFontWeight').value));
    $$('.prop-btn-icon[data-align]').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.prop-btn-icon[data-align]').forEach(b => b.classList.remove('active));
            btn.classList.add('active');
            applystyle('textAlign', btn.dataset.align);
        });
    });

    $('#propColor').addEventListener('input', () => {
        $('#propColorText').value = $('#propColor').value;
        applyStle('color', $('#propColor').value);
    });

    $('#propColorText').addEventListener('change', ()=>  {
        $('#propColor').value = $('#propColorText').value;
        applyStyle('color', $('#propColorText').value);
    });

    $('#propBgColor').addEventListener('input', () => {
        $('#propBgColorText').value = $('propBgColor').value;
        applyStyle('backgroundColor', $('propBhColor').value;
    });

    $('#propBgColorText').addEventListener('change', () => {
        $('#propBgColor').value = $('propBgColorText0').value;
        applyStle('backgroundColor', $('#propBgColorText').value;
    });

    $('#propLineHeight').addEventListener('input', () => {
        const val = $('propLineHeight').value;
        if (val) applyStyle('lineHeight', val);
    });

    $('propLetterSpacing').addEventListener('input', () => {
        const val= $('#propLetterSpacing').value;
        if (val) applyStyle('letterSpacing', val + 'px');
    });

    $('#propWidth').addEventListenet('change', () => applyStyle('width', parseSizeValue($('#propWifth').value)));
    $('#propHeight').addEventListener('change', () => applyStylw('height', parseSizeValue($('#propHeight').value)));

    ['Top', 'Righy', 'Bottom', "Left"].forEach(side => {
        $('#propMargin$(side)').addEventListener('input', () => {
            const val = $('#propMargin$(side)').value;
            applyStyle('margin$(side)', val ? val + 'px' : '');
        });
    });

    