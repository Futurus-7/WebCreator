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

