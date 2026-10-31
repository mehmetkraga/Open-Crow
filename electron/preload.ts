import { contextBridge, ipcRenderer } from 'electron';

export interface KragaAPI {
  fs: {
    openFolder: () => Promise<string | null>;
    readDirectory: (dirPath: string) => Promise<any[]>;
    readFile: (filePath: string) => Promise<string>;
    readBinaryFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    writeBinaryFile: (filePath: string, base64Data: string) => Promise<boolean>;
    deletePath: (targetPath: string) => Promise<boolean>;
    rename: (oldPath: string, newPath: string) => Promise<boolean>;
    createDirectory: (dirPath: string) => Promise<boolean>;
    revealInFolder: (targetPath: string) => Promise<boolean>;
    openPath: (targetPath: string) => Promise<boolean>;
  };
  docs: {
    read: (filePath: string, opts?: { maxChars?: number; range?: string }) => Promise<any>;
    create: (filePath: string, spec: any) => Promise<any>;
    edit: (filePath: string, operations: any[]) => Promise<any>;
  };
  workspace: {
    grep: (root: string, pattern: string, opts?: { glob?: string; ignoreCase?: boolean; literal?: boolean; limit?: number }) => Promise<any>;
    glob: (root: string, pattern: string, limit?: number) => Promise<any>;
  };
  web: {
    fetch: (url: string, maxChars?: number) => Promise<any>;
    search: (query: string, limit?: number) => Promise<any>;
  };
  system: {
    getPaths: () => Promise<{ desktop: string; home: string; downloads: string; temp: string; platform: string }>;
  };
  terminal: {
    runCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    createSession: (sessionId: string, cwd: string) => Promise<boolean>;
    writeSession: (sessionId: string, data: string) => Promise<void>;
    killSession: (sessionId: string) => Promise<void>;
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => () => void;
    onExit: (callback: (payload: { sessionId: string; code: number }) => void) => () => void;
  };
  mcp: {
    loadConfig: (configPath: string) => Promise<boolean>;
    getTools: () => Promise<any[]>;
    callTool: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<any>;
    connectServer: (name: string, config: { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> }) => Promise<boolean>;
    getLastError: (name: string) => Promise<string>;
    disconnectServer: (name: string) => Promise<boolean>;
    disconnectAll: () => Promise<boolean>;
    getConnectedServers: () => Promise<string[]>;
    refreshTools: () => Promise<any[]>;
  };
  graphify: {
    analyze: (projectPath: string) => Promise<any>;
  };
  updater: {
    check: () => Promise<any>;
    download: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
    install: () => Promise<boolean>;
    getVersion: () => Promise<string>;
    onProgress: (callback: (progress: { percent: number; downloaded: number; total: number }) => void) => () => void;
    onDownloaded: (callback: (info: { version: string; filePath: string }) => void) => () => void;
    onAvailable: (callback: (info: any) => void) => () => void;
  };
  app: {
    getPlatform: () => string;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    openExternal: (url: string) => Promise<boolean>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
  };
}

const api: KragaAPI = {
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    readBinaryFile: (filePath) => ipcRenderer.invoke('fs:readBinaryFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    writeBinaryFile: (filePath, base64Data) => ipcRenderer.invoke('fs:writeBinaryFile', filePath, base64Data),
    deletePath: (targetPath) => ipcRenderer.invoke('fs:deletePath', targetPath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
    revealInFolder: (targetPath) => ipcRenderer.invoke('fs:revealInFolder', targetPath),
    openPath: (targetPath) => ipcRenderer.invoke('fs:openPath', targetPath),
  },
  docs: {
    read: (filePath, opts) => ipcRenderer.invoke('docs:read', filePath, opts),
    create: (filePath, spec) => ipcRenderer.invoke('docs:create', filePath, spec),
    edit: (filePath, operations) => ipcRenderer.invoke('docs:edit', filePath, operations),
  },
  workspace: {
    grep: (root, pattern, opts) => ipcRenderer.invoke('ws:grep', root, pattern, opts),
    glob: (root, pattern, limit) => ipcRenderer.invoke('ws:glob', root, pattern, limit),
  },
  web: {
    fetch: (url, maxChars) => ipcRenderer.invoke('web:fetch', url, maxChars),
    search: (query, limit) => ipcRenderer.invoke('web:search', query, limit),
  },
  system: {
    getPaths: () => ipcRenderer.invoke('system:getPaths'),
  },
  terminal: {
    runCommand: (command, cwd) => ipcRenderer.invoke('terminal:runCommand', command, cwd),
    createSession: (sessionId, cwd) => ipcRenderer.invoke('terminal:createSession', sessionId, cwd),
    writeSession: (sessionId, data) => ipcRenderer.invoke('terminal:writeSession', sessionId, data),
    killSession: (sessionId) => ipcRenderer.invoke('terminal:killSession', sessionId),
    onData: (callback) => {
      const listener = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (callback) => {
      const listener = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
  mcp: {
    loadConfig: (configPath) => ipcRenderer.invoke('mcp:loadConfig', configPath),
    getTools: () => ipcRenderer.invoke('mcp:getTools'),
    callTool: (serverName, toolName, args) => ipcRenderer.invoke('mcp:callTool', serverName, toolName, args),
    connectServer: (name, config) => ipcRenderer.invoke('mcp:connectServer', name, config),
    disconnectServer: (name) => ipcRenderer.invoke('mcp:disconnectServer', name),
    disconnectAll: () => ipcRenderer.invoke('mcp:disconnectAll'),
    getConnectedServers: () => ipcRenderer.invoke('mcp:getConnectedServers'),
    refreshTools: () => ipcRenderer.invoke('mcp:refreshTools'),
    getLastError: (name) => ipcRenderer.invoke('mcp:getLastError', name),
  },
  graphify: {
    analyze: (projectPath) => ipcRenderer.invoke('graphify:analyze', projectPath),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    onProgress: (callback) => {
      const listener = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('updater:progress', listener);
      return () => ipcRenderer.removeListener('updater:progress', listener);
    },
    onDownloaded: (callback) => {
      const listener = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('updater:downloaded', listener);
      return () => ipcRenderer.removeListener('updater:downloaded', listener);
    },
    onAvailable: (callback) => {
      const listener = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('updater:available', listener);
      return () => ipcRenderer.removeListener('updater:available', listener);
    },
  },
  app: {
    getPlatform: () => process.platform,
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    close: () => ipcRenderer.send('app:close'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    isMaximized: () => ipcRenderer.invoke('app:isMaximized'),
    onMaximizeChange: (callback) => {
      const listener = (_: any, isMax: boolean) => callback(isMax);
      ipcRenderer.on('app:maximize-change', listener);
      return () => ipcRenderer.removeListener('app:maximize-change', listener);
    },
  },
};

contextBridge.exposeInMainWorld('kragaAPI', api);
