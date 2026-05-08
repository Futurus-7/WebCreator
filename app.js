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

document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initToolbar();
    initViewport();
    initPanelSections();
    initPropertyTabs();
    initPropertyInputs();
    initContextMenu();
    initLayers();
    initModals();
    initKeyboard();
    saveHistory();
});

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

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    removeAllDropIndicators();

    const target = getDropTarget(e);

    if (target) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY  < midY ? 'before' : 'after';
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
    wrapper.draggable = true;

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
        'form': 'Modulo',
        'input': 'Campo testo',
        'textarea': 'Area testo',
        'select': 'Menu a tendina',
        'checkbox': 'Checkbox',
        'block-hero': 'Hero',
        'block-navbar': 'Navbar',
        'block-footer': 'Footer',
        'block-card': 'Card',
        'block-pricing': 'Pricing',
        'block-testimonial': 'Testimonial'
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
                'form': '<form class="wb-form" onsubmit="return false;"></form>',
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
                        </div>`
    };
    return templates[type] || '<div>Elemento</div>';
}


function setupElementEvents(element) {
    element.addEventListener('click', (e) => {
        e.stopPropagation();
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
    setupElementEvents(clone);
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
        if (next && !next.classList.contains('element-actions')) {
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
                img.alt = $('#propAlt').value || '';
            }
            saveHistory();
        }
    });

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
        const target = getStyleTarget(state.selectedElement);
        target.id = $('#propId').value;
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
}

function applyStyle(property, value) {
    if (!state.selectedElement) return;
    const target = getStyleTarget(state.selectedElement);
    target.style[property] = value;
    clearTimeout(state._styleTimeout);
    state._styleTimeout = setTimeout(() => saveHistory(), 300);
}

function getStyleTarget(element) {
    const directChild = element.querySelector(
        '.wb-section, .wb-container, .wb-columns, .wb-grid, .wb-heading, ' +
        '.wb-paragraph, .wb-image, .wb-button, .wb-link, .wb-divider, ' +
        '.wb-spacer, .wb-video, .wb-icon, .wb-map, .wb-form, .wb-input, ' +
        '.wb-textarea-el, .wb-select, .wb-checkbox-wrapper, .wb-hero, ' +
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
    $('#propImageSrc').value = img ? img.src : '';
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

    $('#propId').value = target.id || '';
    const userClasses = Array.from(target.classList).filter(c => !c.startsWith('wb-') && c !== 'builder-element' && c !== 'selected');
    $('#propClasses').value = userClasses.join(' ');
    $('#propCustomCSS').value = '';
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

function updateLayerSelection() {
    $$('.layer-item').forEach(item => item.classList.remove('active'));
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
    'form': 'fa-solid fa-rectangle-list',
    'input': 'fa-solid fa-i-cursor',
    'textarea': 'fa-solid fa-caret-down',
    'checkbox': 'fa-solid fa-square-check',
    'block-hero': 'fa-solid fa-panorama',
    'block-navbar': 'fa-solid fa-bars',
    'block-footer': 'fa-solid fa-shoe-prints',
    'block-card': 'fa-solid fa-id-card',
    'block-pricing': 'fa-solid fa-tags',
    'block-testimonial': 'fa-solid fa-quote-left'
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
        navigator.clipboard.writeText(codeOutput.textContent).then(() => {
            const btn = $('#btnCopyCode');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        });
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
    clone.querySelectorAll('.element-actions, .drop-indicator, .canvas-empty').forEach(el => el.remove());
    clone.querySelectorAll('.builder-element').forEach(el => {
        el.classList.remove('builder-element', 'selected', 'drag-over');
        el.removeAttribute('data-type');
        el.removeAttribute('data-id');
        el.removeAttribute('data-label');
        el.removeAttribute('draggable');
    });

    clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
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
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Il mio sito</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; }
        img { max-width: 100%; height: auto; }
${styles}
    </style>
</head>
<body>
${bodyContent}
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
        .wb-button { display: inline-block; padding: 12px 28px; background: #4361ee; color: white; border: none; border-radius: 4px; font-size: 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
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
    const html = generateFullHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sito-web.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        const data = {
            html: canvas.innerHTML,
            counter: state.elementCounter,
            timestamp: Date.now()
        };
        localStorage.setItem('webbuilder-autosave', JSON.stringify(data));
    } catch (e) {
    }
}

function autoLoad() {
    try {
        const saved = localStorage.getItem('webbuilder-autosave');
        if (!saved) return false;
        const data = JSON.parse(saved);
        if (!data.html) return false;
        canvas.innerHTML = data.html;
        state.elementCounter = data.counter || 0;
        canvas.classList.remove('free-mode');
        canvas.querySelectorAll('.builder-element').forEach(el => {
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
            setupElementEvents(el);
        });
        hideCanvasEmpty();
        return true;
    } catch (e) {
        return false;
    }
}

setInterval(autoSave, 5000);
document.addEventListener('DOMContentLoaded', () => {
    const loaded = autoLoad();
    if(loaded) {
        saveHistory();
        updateLayers();
    }
});

let currentMode = 'structure';
function initModes() {
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchMode(btn.dataset.mode);    
        });
    });
}

let structureHTML = '';
let freeHTML = '';
function switchMode(mode) {
    deselectElement();
    if (currentMode === 'structure') {
        structureHTML = canvas.innerHTML;
    } else {
        freeHTML = canvas.innerHTML;
    }
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
    if (el.querySelector('.resize-handle')) return;
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

function startResize(el, handle, startEvent) {
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startLeft = parseInt(el.style.left) || 0;
    const startTop = parseInt(el.style.top) || 0;

    function onMouseMove(e) {
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
            innerContent.style.overflow = 'hidden';
        }
        updateFreeToolbarValues(el);
    }
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveHistory();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}



function addFreeDrag(el) {
    el.addEventListener('mousedown', function(e) {
        if (currentMode !== 'free') return;
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.closest('.element-actions')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.target.isContentEditable && document.activeElement === e.target) return;
        e.preventDefault();
        selectElement(el);
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(el.style.left) || 0;
        const startTop = parseInt(el.style.top) || 0;

        function onMouseMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            el.style.left = (startLeft + dx) + 'px';
            el.style.top = (startTop + dy) + 'px';
            updateFreeToolbarValues(el);
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            saveHistory();
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
const originalSelectElement = selectElement;
selectElement = function(element) {
    originalSelectElement(element);
    if (currentMode === 'free') {
        updateFreeToolbarValues(element);
    }
};

const originalCreateElement = createElement;
createElement = function(type) {
    const el = originalCreateElement(type);
    if (currentMode === 'free') {
        el.style.position = 'absolute';
        el.style.left = '50px';
        el.style.top = '50px';
        addResizeHandles(el);
        addFreeDrag(el);
    }
    return el;
};
document.addEventListener('DOMContentLoaded', () => {
    initModes();
    initFreeToolbar();
});