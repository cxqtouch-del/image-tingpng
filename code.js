"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 300, height: 390 });
// Function to send selected nodes to the UI
function postSelectedNodesToUI() {
    return __awaiter(this, void 0, void 0, function* () {
        const selectedNodes = figma.currentPage.selection
            .filter(node => node.type === "FRAME" || node.type === "GROUP" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR" || node.type === "VECTOR" || node.type === "TEXT" || node.type === "SLICE" || node.type === "SECTION")
            .slice(0, 10); // Limit to first 10 selected nodes
        const nodesForUI = yield Promise.all(selectedNodes.map((node) => __awaiter(this, void 0, void 0, function* () {
            let thumbnailBytes = null;
            try {
                thumbnailBytes = yield node.exportAsync({
                    format: 'PNG',
                    constraint: { type: 'WIDTH', value: 48 } // Generate a 48px width thumbnail
                });
            }
            catch (e) {
                console.error(`Could not generate thumbnail for node ${node.name}:`, e);
            }
            return {
                id: node.id,
                name: node.name,
                width: node.width ? Math.round(node.width) : 0,
                height: node.height ? Math.round(node.height) : 0,
                thumbnail: thumbnailBytes // This can be null if export fails
            };
        })));
        figma.ui.postMessage({ type: 'selection-change', nodes: nodesForUI });
    });
}
// Initial post of selected nodes when plugin starts
postSelectedNodesToUI();
// Listen for selection changes in Figma
figma.on('selectionchange', () => {
    postSelectedNodesToUI();
});
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'ui-ready') {
        // Load saved settings when UI is ready
        try {
            const apiKey = yield figma.clientStorage.getAsync('tinify-api-key');
            const hasShownInfoModal = yield figma.clientStorage.getAsync('has-shown-info-modal');
            // Always send response, even if key is null/undefined
            figma.ui.postMessage({
                type: 'load-settings',
                apiKey: apiKey || '',
                hasShownInfoModal: !!hasShownInfoModal
            });
        }
        catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
    else if (msg.type === 'save-api-key') {
        yield figma.clientStorage.setAsync('tinify-api-key', msg.apiKey);
        figma.ui.postMessage({ type: 'api-key-saved', apiKey: msg.apiKey });
    }
    else if (msg.type === 'save-has-shown-info-modal') {
        yield figma.clientStorage.setAsync('has-shown-info-modal', true);
    }
    else if (msg.type === 'export-image') {
        console.log('Received nodeIds from UI:', msg.settings.nodeIds);
        const { nodeIds, scales, format, compress } = msg.settings;
        if (!nodeIds || nodeIds.length === 0) {
            figma.ui.postMessage({ type: 'error', message: '没有选择任何图层进行导出。' });
            return;
        }
        if (!scales || scales.length === 0) {
            figma.ui.postMessage({ type: 'error', message: '没有选择任何导出尺寸。' });
            return;
        }
        const nodesToExport = nodeIds
            .map((id) => figma.getNodeById(id))
            .filter(Boolean);
        if (nodesToExport.length === 0) {
            figma.ui.postMessage({ type: 'error', message: '选中的图层在Figma中不存在或已取消选择。' });
            return;
        }
        let exportCount = 0;
        const exportJobs = [];
        for (const node of nodesToExport) {
            for (const scale of scales) {
                try {
                    let options;
                    const constraintValue = { type: 'SCALE', value: scale };
                    if (format === 'JPG') {
                        options = Object.assign(Object.assign({ format: 'JPG' }, (compress ? { quality: 0.5 } : {})), { constraint: constraintValue });
                    }
                    else if (format === 'PNG') {
                        options = {
                            format: 'PNG',
                            constraint: constraintValue,
                        };
                    }
                    else if (format === 'SVG') {
                        options = {
                            format: 'SVG',
                        };
                    }
                    else {
                        figma.ui.postMessage({ type: 'error', message: `不支持的导出格式: ${format}` });
                        continue;
                    }
                    const imageBytes = yield node.exportAsync(options);
                    figma.ui.postMessage({
                        type: 'export-complete-data',
                        filename: `${node.name}@${scale}x.${format.toLowerCase()}`,
                        bytes: Array.from(imageBytes) // Convert back to Array for message passing
                    });
                    exportCount++;
                }
                catch (error) {
                    figma.ui.postMessage({ type: 'error', message: `导出 ${node.name} (${scale}x) 失败: ${error.message}` });
                }
            }
        }
        figma.ui.postMessage({ type: 'export-all-complete', total: exportCount });
    }
    else if (msg.type === 'resize') {
        const minH = 390;
        const maxH = 800;
        const h = Math.max(minH, Math.min(maxH, Number(msg.height) || minH));
        figma.ui.resize(300, h);
    }
});
