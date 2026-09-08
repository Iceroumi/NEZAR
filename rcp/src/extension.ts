import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ---------- Вспомогательные функции для команд ----------
const codeExtensions = [
  'ts', 'js', 'tsx', 'jsx', 'html', 'css', 'scss', 'less',
  'json', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs',
  'rb', 'php', 'sql', 'sh', 'bash', 'yml', 'yaml', 'xml',
  'md', 'txt', 'vue', 'svelte'
];

const skipDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', 'out', 'bin', 'obj'];

interface FileEntry {
  relative: string;
  content: string;
}

function getOutputDir(rootPath: string): string {
  const outputDir = path.join(rootPath, 'RCP_AI');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function collectFiles(rootPath: string): FileEntry[] {
  const files: FileEntry[] = [];
  function walkDir(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!skipDirs.includes(item.name)) walkDir(fullPath);
      } else {
        const ext = item.name.split('.').pop() || '';
        if (codeExtensions.includes(ext)) {
          files.push({
            relative: path.relative(rootPath, fullPath),
            content: fs.readFileSync(fullPath, 'utf-8')
          });
        }
      }
    }
  }
  walkDir(rootPath);
  return files;
}

class Section1Provider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateView();

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'copy') {
                const commandId = message.commandId;
                let resultText = '';

                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage('Откройте папку в VS Code!');
                    return;
                }
                const rootPath = workspaceFolders[0].uri.fsPath;

                switch (commandId) {
                    case 'merge': {
                        const files = collectFiles(rootPath);
                        const lines: string[] = [];
                        lines.push('=== MERGED CODE ===');
                        lines.push(`Папка: ${path.basename(rootPath)}`);
                        lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
                        lines.push(`Файлов: ${files.length}`);
                        lines.push('');
                        for (const file of files) {
                            lines.push(`========================================`);
                            lines.push(`Файл: ${file.relative}`);
                            lines.push(`========================================`);
                            lines.push(file.content);
                            lines.push('');
                        }
                        resultText = lines.join('\n');
                        break;
                    }
                    case 'minify': {
                        const files = collectFiles(rootPath);
                        const parts: string[] = [];
                        parts.push(`/* MERGED MINIFIED | ${path.basename(rootPath)} | ${new Date().toLocaleString('ru-RU')} | Файлов: ${files.length} */`);
                        for (const file of files) {
                            const minified = file.content.split('\n').map(l => l.trim()).filter(l => l.length > 0).join(' ');
                            parts.push(`/*=${file.relative}=*/${minified}`);
                        }
                        resultText = parts.join('\n');
                        break;
                    }
                    case 'currentFile': {
                        const editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            vscode.window.showErrorMessage('Нет открытого файла!');
                            return;
                        }
                        resultText = editor.document.getText();
                        break;
                    }
                    case 'tree': {
                        const lines: string[] = [];
                        lines.push(`Дерево проекта: ${path.basename(rootPath)}`);
                        lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
                        lines.push('');
                        function walkDir(dir: string, prefix: string) {
                            let items: fs.Dirent[];
                            try {
                                items = fs.readdirSync(dir, { withFileTypes: true });
                            } catch {
                                return;
                            }
                            const sorted = items
                                .filter(item => {
                                    if (item.name.startsWith('.')) return false;
                                    if (item.isDirectory() && skipDirs.includes(item.name)) return false;
                                    return true;
                                })
                                .sort((a, b) => {
                                    if (a.isDirectory() && !b.isDirectory()) return -1;
                                    if (!a.isDirectory() && b.isDirectory()) return 1;
                                    return a.name.localeCompare(b.name);
                                });
                            sorted.forEach((item, index) => {
                                const isLast = index === sorted.length - 1;
                                const connector = isLast ? '└── ' : '├── ';
                                const newPrefix = isLast ? '    ' : '│   ';
                                const fullPath = path.join(dir, item.name);
                                lines.push(`${prefix}${connector}${item.name}`);
                                if (item.isDirectory()) {
                                    walkDir(fullPath, prefix + newPrefix);
                                }
                            });
                        }
                        lines.push(path.basename(rootPath) + '/');
                        walkDir(rootPath, '');
                        resultText = lines.join('\n');
                        break;
                    }
                    default:
                        vscode.window.showErrorMessage('Неизвестная команда');
                        return;
                }

                await vscode.env.clipboard.writeText(resultText);
                vscode.window.showInformationMessage('Результат скопирован в буфер обмена!');
            }
        });
    }

    private updateView() {
        if (!this._view) return;
        this._view.webview.html = this.getHtml();
    }

    private getHtml(): string {
        const commands = [
            { id: 'merge', label: '📁 Собрать все файлы в один' },
            { id: 'minify', label: '⚡ Собрать все файлы без пробелов' },
            { id: 'currentFile', label: '📄 Копировать текущий файл' },
            { id: 'tree', label: '🌳 Дерево проекта' }
        ];

        const items = commands.map(cmd => `
            <li style="display: flex; justify-content: space-between; align-items: center; margin: 4px 0;">
                <span style="flex:1;">${cmd.label}</span>
                <button onclick="copyCommand('${cmd.id}')">Копировать</button>
            </li>
        `).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { padding: 10px; font-family: var(--vscode-font-family); }
                ul { list-style: none; padding: 0; }
                li { padding: 6px 8px; background: var(--vscode-list-inactiveSelectionBackground); border-radius: 4px; margin-bottom: 4px; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
                button:hover { background: var(--vscode-button-hoverBackground); }
            </style>
        </head>
        <body>
            <ul>${items}</ul>
            <script>
                const vscode = acquireVsCodeApi();
                function copyCommand(id) {
                    vscode.postMessage({ command: 'copy', commandId: id });
                }
            </script>
        </body>
        </html>
        `;
    }
}

// ---------- Провайдер для пустых разделов ----------
class EmptySectionProvider implements vscode.WebviewViewProvider {
  constructor(private message: string) {}
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.html = `
      <!DOCTYPE html>
      <html>
      <body style="padding: 10px; color: var(--vscode-descriptionForeground);">
        <p>${this.message}</p>
      </body>
      </html>
    `;
  }
}

// ---------- Активация расширения ----------
export function activate(context: vscode.ExtensionContext) {
  // ---- Регистрация команд ----
  const mergeCmd = vscode.commands.registerCommand(
    'RCP.mergeFiles',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Откройте папку в VS Code!');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const files = collectFiles(rootPath);
      const lines: string[] = [];
      lines.push('=== MERGED CODE ===');
      lines.push(`Папка: ${path.basename(rootPath)}`);
      lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
      lines.push(`Файлов: ${files.length}`);
      lines.push('');
      for (const file of files) {
        lines.push(`========================================`);
        lines.push(`Файл: ${file.relative}`);
        lines.push(`========================================`);
        lines.push(file.content);
        lines.push('');
      }
      const outputPath = path.join(getOutputDir(rootPath), 'merged-code.txt');
      fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`Готово! ${files.length} файлов → RCP_AI/merged-code.txt`);
    }
  );

  const miniCmd = vscode.commands.registerCommand(
    'RCP.minification',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Откройте папку в VS Code!');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const files = collectFiles(rootPath);
      const parts: string[] = [];
      parts.push(`/* MERGED MINIFIED | ${path.basename(rootPath)} | ${new Date().toLocaleString('ru-RU')} | Файлов: ${files.length} */`);
      for (const file of files) {
        const minified = file.content.split('\n').map(l => l.trim()).filter(l => l.length > 0).join(' ');
        parts.push(`/*=${file.relative}=*/${minified}`);
      }
      const outputPath = path.join(getOutputDir(rootPath), 'merged-mini.txt');
      fs.writeFileSync(outputPath, parts.join('\n'), 'utf-8');
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`Готово! ${files.length} файлов → RCP_AI/merged-mini.txt`);
    }
  );

  const currentFileCmd = vscode.commands.registerCommand(
    'RCP.currentFile',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('Нет открытого файла!');
        return;
      }
      const fileName = path.basename(editor.document.uri.fsPath);
      await vscode.env.clipboard.writeText(editor.document.getText());
      vscode.window.showInformationMessage(`${fileName} скопирован в буфер обмена!`);
    }
  );

  const treeListCmd = vscode.commands.registerCommand(
    'RCP.treeList',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Откройте папку в VS Code!');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const lines: string[] = [];
      lines.push(`Дерево проекта: ${path.basename(rootPath)}`);
      lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
      lines.push('');
      function walkDir(dir: string, prefix: string) {
        let items: fs.Dirent[];
        try {
          items = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        const sorted = items
          .filter(item => {
            if (item.name.startsWith('.')) return false;
            if (item.isDirectory() && skipDirs.includes(item.name)) return false;
            return true;
          })
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });
        sorted.forEach((item, index) => {
          const isLast = index === sorted.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const newPrefix = isLast ? '    ' : '│   ';
          const fullPath = path.join(dir, item.name);
          lines.push(`${prefix}${connector}${item.name}`);
          if (item.isDirectory()) {
            walkDir(fullPath, prefix + newPrefix);
          }
        });
      }
      lines.push(path.basename(rootPath) + '/');
      walkDir(rootPath, '');
      const outputPath = path.join(getOutputDir(rootPath), 'tree-list.txt');
      fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Дерево сохранено → RCP_AI/tree-list.txt');
    }
  );

  // ---- Регистрация провайдеров для боковой панели ----
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('rcp-section1', new Section1Provider()),
    vscode.window.registerWebviewViewProvider('rcp-section2', new EmptySectionProvider('Раздел 2 – пока пусто')),
    vscode.window.registerWebviewViewProvider('rcp-section3', new EmptySectionProvider('Раздел 3 – пока пусто'))
  );

  // ---- Добавляем все команды в subscriptions ----
  context.subscriptions.push(mergeCmd, miniCmd, currentFileCmd, treeListCmd);
}

export function deactivate() {}