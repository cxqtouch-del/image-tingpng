figma.showUI(__html__, { width: 300, height: 400 });

const EXPORT_CHUNK_SIZE = 64 * 1024;

function postExportFileInChunks(fileId: string, filename: string, bytes: Uint8Array) {
  const totalChunks = Math.max(1, Math.ceil(bytes.length / EXPORT_CHUNK_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * EXPORT_CHUNK_SIZE;
    const end = Math.min(start + EXPORT_CHUNK_SIZE, bytes.length);
    const chunkBytes = bytes.slice(start, end);

    figma.ui.postMessage({
      type: 'export-file-chunk',
      fileId,
      filename,
      chunkIndex,
      totalChunks,
      bytes: Array.from(chunkBytes),
    });
  }
}

// Function to send selected nodes to the UI
async function postSelectedNodesToUI() {
  const MAX_NODES_FOR_UI = 5;

  const allSelectedNodes = figma.currentPage.selection
    .filter(node => node.type === "FRAME" || node.type === "GROUP" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR" || node.type === "VECTOR" || node.type === "TEXT" || node.type === "SLICE" || node.type === "SECTION")
  const selectedNodes = allSelectedNodes.slice(0, MAX_NODES_FOR_UI); // Limit to first 5 selected nodes

  const nodesForUI = await Promise.all(selectedNodes.map(async (node) => {
    let thumbnailBytes = null;
    try {
      thumbnailBytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'WIDTH', value: 96 } // Generate a 96px width thumbnail for sharper UI preview
      });
    } catch (e) {
      console.error(`Could not generate thumbnail for node ${node.name}:`, e);
    }

    return {
      id: node.id,
      name: node.name,
      width: node.width ? Math.round(node.width) : 0,
      height: node.height ? Math.round(node.height) : 0,
      thumbnail: thumbnailBytes // This can be null if export fails
    };
  }));

  figma.ui.postMessage({
    type: 'selection-change',
    nodes: nodesForUI,
    totalSelectedCount: allSelectedNodes.length
  });
}

// Initial post of selected nodes when plugin starts
postSelectedNodesToUI();

// Listen for selection changes in Figma
figma.on('selectionchange', () => {
  postSelectedNodesToUI();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'ui-ready') {
    // Load saved settings when UI is ready
    try {
      const apiKey = await figma.clientStorage.getAsync('tinify-api-key');
      const hasShownInfoModal = await figma.clientStorage.getAsync('has-shown-info-modal');
      const compressionCount = await figma.clientStorage.getAsync('tinify-compression-count');
      
      // Always send response, even if key is null/undefined
      figma.ui.postMessage({ 
        type: 'load-settings', 
        apiKey: apiKey || '',
        hasShownInfoModal: !!hasShownInfoModal,
        compressionCount: typeof compressionCount === 'number' ? compressionCount : null
      });
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  } else if (msg.type === 'save-compression-count') {
    const count = msg.count;
    if (typeof count === 'number' && count >= 0) {
      await figma.clientStorage.setAsync('tinify-compression-count', count);
      figma.ui.postMessage({ type: 'compression-count-updated', count });
    }
  } else if (msg.type === 'save-api-key') {
    await figma.clientStorage.setAsync('tinify-api-key', msg.apiKey);
    figma.ui.postMessage({ type: 'api-key-saved', apiKey: msg.apiKey });
  } else if (msg.type === 'save-has-shown-info-modal') {
    await figma.clientStorage.setAsync('has-shown-info-modal', true);
  } else if (msg.type === 'export-image') {
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

    const resolvedNodes = await Promise.all(
      (nodeIds as string[]).map(async (id: string) => {
        try {
          return await figma.getNodeByIdAsync(id);
        } catch {
          return null;
        }
      })
    );

    const nodesToExport = resolvedNodes.filter(Boolean) as SceneNode[];

    if (nodesToExport.length === 0) {
      figma.ui.postMessage({ type: 'error', message: '选中的图层在Figma中不存在或已取消选择。' });
      return;
    }

    let exportCount = 0;

    for (const node of nodesToExport) {
      for (const scale of scales) {
        try {
          let options: ExportSettings;

          const constraintValue: {
            type: 'SCALE';
            value: number;
          } = { type: 'SCALE', value: scale };

          if (format === 'JPG') {
            options = {
              format: 'JPG',
              ...(compress ? { quality: 0.5 } : {}), // stronger compression when enabled
              constraint: constraintValue,
            };
          } else if (format === 'PNG') {
            options = {
              format: 'PNG',
              constraint: constraintValue,
            };
          } else if (format === 'SVG') {
            options = {
              format: 'SVG',
            };
          } else {
            figma.ui.postMessage({ type: 'error', message: `不支持的导出格式: ${format}` });
            continue;
          }

          const imageBytes = await node.exportAsync(options);
          const filename = `${node.name}@${scale}x.${format.toLowerCase()}`;
          const fileId = `${node.id}:${scale}:${format}`;
          postExportFileInChunks(fileId, filename, imageBytes);
          exportCount++;

        } catch (error: any) {
          figma.ui.postMessage({ type: 'error', message: `导出 ${node.name} (${scale}x) 失败: ${(error as Error).message}` });
        }
      }
    }

    figma.ui.postMessage({ type: 'export-all-complete', total: exportCount });
  } else if (msg.type === 'resize') {
    const h = Math.max(0, Math.ceil(Number(msg.height) || 0));
    figma.ui.resize(300, h);
  }
};
