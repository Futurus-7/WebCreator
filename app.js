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