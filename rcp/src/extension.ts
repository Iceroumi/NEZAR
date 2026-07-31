import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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


// Добавь эту функцию в начало файла
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
        if (!skipDirs.includes(item.name)) {
          walkDir(fullPath);
        }
      } else {
        const ext = item.name.split('.').pop() || '';
        if (codeExtensions.includes(ext)) {
          const relative = path.relative(rootPath, fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ relative, content });
        }
      }
    }
  }

  walkDir(rootPath);
  return files;
}

export function activate(context: vscode.ExtensionContext) {

  // Команда 1: Собрать все файлы в один
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

      vscode.window.showInformationMessage(
        `Готово! ${files.length} файлов → merged-code.txt`
      );
    }
  );

  // Команда 2: Собрать без пробелов (минифицированный)
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
        // Убираем лишние пробелы и пустые строки
        const minified = file.content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join(' ');
        parts.push(`/*=${file.relative}=*/${minified}`);
      }

      const outputPath = path.join(getOutputDir(rootPath), 'merged-mini.txt');
      fs.writeFileSync(outputPath, parts.join('\n'), 'utf-8');

      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        `Готово! ${files.length} файлов → merged-mini.txt`
      );
    }
  );

 const currentFile = vscode.commands.registerCommand(
  'RCP.currentFile',
  async () => {
    // Получаем текущий открытый файл
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Нет открытого файла!');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const fileName = path.basename(filePath);
    const content = editor.document.getText();

    // Копируем содержимое в буфер обмена
    await vscode.env.clipboard.writeText(content);

    vscode.window.showInformationMessage(
      `Файл ${fileName} скопирован в буфер обмена!`
    );
  }
);

const treeList = vscode.commands.registerCommand(
  'RCP.treeList',
  async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('Откройте папку в VS Code!');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', 'out', 'bin', 'obj'];
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

      // Сортировка: папки первые
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

    // Сохраняем
    const outputPath = path.join(getOutputDir(rootPath), 'tree-list.txt');
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

    const doc = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage('Дерево сохранено → tree-list.txt');
  }
);

  context.subscriptions.push(mergeCmd, miniCmd);
}

export function deactivate() {}