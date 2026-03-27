declare const EXPORT_CHUNK_SIZE: number;
declare function postExportFileInChunks(fileId: string, filename: string, bytes: Uint8Array): void;
declare function postSelectedNodesToUI(): Promise<void>;
