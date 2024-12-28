import * as vscode from "vscode";

interface ImportItem {
  original: string;
  normalized: string;
}

export function activate(context: vscode.ExtensionContext) {
  // Command to align imports manually
  const disposable = vscode.commands.registerCommand(
    "extension.alignImports",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        void formatImports();
      }
    }
  );

  // Save handler
  let isFormatting = false;
  const saveDisposable = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    // Skip if already formatting
    if (isFormatting) {
      return;
    }

    if (
      ["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(
        document.languageId
      )
    ) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        isFormatting = true;
        void formatImports().finally(() => {
          isFormatting = false;
        });
      }
    }
  });

  context.subscriptions.push(disposable, saveDisposable);
}

async function formatImports(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const sortedText = sortAndFormatImports(text);

  // Only make changes if the text actually changed
  if (sortedText !== text) {
    await editor.edit((editBuilder: vscode.TextEditorEdit) => {
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );
      editBuilder.replace(fullRange, sortedText);
    });
  }
}

function sortAndFormatImports(text: string): string {
  const lines: string[] = text.split("\n");
  const importStatements: string[] = [];
  const otherLines: string[] = [];
  const seenImports = new Set<string>();

  let currentImport = "";
  let isInImport = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("import")) {
      isInImport = true;
      currentImport = line;
      braceCount = (trimmedLine.match(/{/g) || []).length - (trimmedLine.match(/}/g) || []).length;
      
      if (braceCount === 0 && trimmedLine.endsWith(";")) {
        if (!seenImports.has(currentImport)) {
          seenImports.add(currentImport);
          importStatements.push(currentImport);
        }
        isInImport = false;
        currentImport = "";
      }
    } else if (isInImport) {
      currentImport += "\n" + line;
      braceCount += (trimmedLine.match(/{/g) || []).length - (trimmedLine.match(/}/g) || []).length;
      
      if (braceCount === 0 && trimmedLine.includes(";")) {
        if (!seenImports.has(currentImport)) {
          seenImports.add(currentImport);
          importStatements.push(currentImport);
        }
        isInImport = false;
        currentImport = "";
      }
    } else if (trimmedLine !== "") {
      otherLines.push(...lines.slice(i));
      break;
    }
  }

  // Group imports
  const packageImports: ImportItem[] = [];
  const atImports: ImportItem[] = [];
  const relativeImports: ImportItem[] = [];

  importStatements.forEach((statement: string) => {
    // Normalize multi-line imports to single line for sorting
    const normalizedStatement = statement
      .replace(/\s+/g, " ")
      .replace(/{\s+/g, "{ ")
      .replace(/\s+}/g, " }")
      .replace(/,\s+/g, ", ");

    if (statement.includes("@")) {
      atImports.push({ original: statement, normalized: normalizedStatement });
    } else if (statement.includes("./") || statement.includes("../")) {
      relativeImports.push({ original: statement, normalized: normalizedStatement });
    } else {
      packageImports.push({ original: statement, normalized: normalizedStatement });
    }
  });

  // Sort imports within their groups
  const sortImports = (imports: ImportItem[]): string[] => {
    return imports
      .sort((a, b) => a.normalized.localeCompare(b.normalized))
      .map(item => item.original);
  };

  // Build the final text with proper spacing
  const importGroups: string[] = [];
  
  if (packageImports.length) {
    importGroups.push(...sortImports(packageImports));
  }
  
  if (atImports.length) {
    if (importGroups.length) {importGroups.push("");}
    importGroups.push(...sortImports(atImports));
  }
  
  if (relativeImports.length) {
    if (importGroups.length) {importGroups.push("");}
    importGroups.push(...sortImports(relativeImports));
  }

  // Combine everything
  const finalLines = importGroups.length > 0 
    ? [...importGroups, "", ...otherLines]
    : otherLines;

  // Remove any trailing empty lines at the end of the file
  while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === "") {
    finalLines.pop();
  }

  // Ensure file ends with exactly one newline
  return finalLines.join("\n") + "\n";
}

export function deactivate(): void {}