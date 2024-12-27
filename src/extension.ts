import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.alignImports",
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active editor found!");
        return;
      }

      const document = editor.document;
      const text = document.getText();

      // Extract and sort imports
      const importLines = text
        .split("\n")
        .filter((line) => line.trim().startsWith("import"));

      const sortedImports = sortImports(importLines);

      // Replace old imports with sorted ones
      const importRange = new vscode.Range(
        document.lineAt(0).range.start,
        document.lineAt(importLines.length - 1).range.end
      );

      editor.edit((editBuilder) => {
        editBuilder.replace(importRange, sortedImports.join("\n"));
      });
    }
  );

  context.subscriptions.push(disposable);
}

function sortImports(importLines: string[]): string[] {
  const packageImports: string[] = [];
  const atImports: string[] = [];
  const relativeImports: string[] = [];

  importLines.forEach((line) => {
    if (line.includes("@")) {
      atImports.push(line);
    } else if (line.includes("./") || line.includes("../")) {
      relativeImports.push(line);
    } else {
      packageImports.push(line);
    }
  });

  return [
    ...packageImports.sort(),
    "",
    ...atImports.sort(),
    "",
    ...relativeImports.sort(),
  ].filter(Boolean); // Remove empty strings
}

export function deactivate() {}
