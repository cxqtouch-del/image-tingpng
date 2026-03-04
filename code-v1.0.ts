figma.showUI(__html__, { width: 300, height: 600 });

// Function to send selected nodes to the UI
async function postSelectedNodesToUI() {
  const selectedNodes = figma.currentPage.selection
    .filter(node => node.type === "FRAME" || node.type === "GROUP" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "RECTANGLE" || node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR" || node.type === "VECTOR" || node.type === "TEXT" || node.type === "SLICE")
    .slice(0, 10); // Limit to first 10 selected nodes

  const nodesForUI = await Promise.all(selectedNodes.map(async (node) => {
    let thumbnailBytes = null;
    try {
      thumbnailBytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'WIDTH', value: 48 } // Generate a 48px width thumbnail
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

  figma.ui.postMessage({ type: 'selection-change', nodes: nodesForUI });
}

// Initial post of selected nodes when plugin starts
postSelectedNodesToUI();

// Listen for selection changes in Figma
figma.on('selectionchange', () => {
  postSelectedNodesToUI();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-image') {
    const { nodeIds, scales, format, compress } = msg.settings;

    if (!nodeIds || nodeIds.length === 0) {
      figma.ui.postMessage({ type: 'error', message: '没有选择任何图层进行导出。' });
      return;
    }
    if (!scales || scales.length === 0) {
      figma.ui.postMessage({ type: 'error', message: '没有选择任何导出尺寸。' });
      return;
    }

    const nodesToExport = figma.currentPage.selection.filter(node => nodeIds.includes(node.id));

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
              ...(compress ? { quality: 0.8 } : {}), // Default JPG quality to 80% if compressed
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

          figma.ui.postMessage({
            type: 'export-complete-data',
            filename: `${node.name}@${scale}x.${format.toLowerCase()}`,
            bytes: Array.from(imageBytes) // Convert Uint8Array to regular Array for message passing
          });
          exportCount++;

        } catch (error: any) {
          figma.ui.postMessage({ type: 'error', message: `导出 ${node.name} (${scale}x) 失败: ${(error as Error).message}` });
        }
      }
    }
    if (exportCount > 0) {
      // No need for a final success message here, individual downloads trigger UI message
    }
    figma.ui.postMessage({ type: 'export-complete', message: '所有选定图层导出完成！' });
  }
};
