import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'mergeFiles.merge',
    async () => {

      // 1. Берём текущую рабочую папку
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Откройте папку в VS Code!');
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;

      // 2. Спрашиваем расширения файлов
      const exts = await vscode.window.showInputBox({
        prompt: 'Расширения через запятую',
        value: 'ts,js,html,css,json,py',
        title: 'Какие файлы собирать?'
      });

      if (!exts) return;
      const extensions = exts.split(',').map(e => e.trim().replace('.', ''));

      // 3. Спрашиваем имя файла
      const fileName = await vscode.window.showInputBox({
        prompt: 'Имя готового файла',
        value: 'merged-code.txt',
        title: 'Название файла'
      });

      if (!fileName) return;

      // 4. Собираем
      const lines: string[] = [];
      lines.push('=== MERGED CODE ===');
      lines.push(`Папка: ${path.basename(rootPath)}`);
      lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
      lines.push('');

      // Папки которые пропускаем
      const skipDirs = ['node_modules', '.git', 'dist', 'build', '.vscode'];

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
            if (extensions.includes(ext)) {
              const relative = path.relative(rootPath, fullPath);
              const content = fs.readFileSync(fullPath, 'utf-8');
              lines.push('');
              lines.push(`========================================`);
              lines.push(`Файл: ${relative}`);
              lines.push(`========================================`);
              lines.push(content);
            }
          }
        }
      }

      walkDir(rootPath);

      // 5. Сохраняем файл РЯДОМ с проектом
      const outputPath = path.join(rootPath, fileName);
      fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

      // 6. Открываем его
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        `Готово! Файл сохранён: ${fileName}`
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {} 