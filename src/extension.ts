import * as vscode from "vscode";

interface ImportItem {
  original: string;
  normalized: string;
  startLine: number;
  endLine: number;
  comments: string[];
}

interface ImportBlock {
  imports: ImportItem[];
  precedingComments: string[];
  blankLinesBefore: number;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.alignImports",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        void formatImports();
      }
    }
  );

  let isInternalSave = false;
  
  const saveDisposable = vscode.workspace.onWillSaveTextDocument((event: vscode.TextDocumentWillSaveEvent) => {
    if (
      !isInternalSave && 
      event.reason === vscode.TextDocumentSaveReason.Manual &&
      ["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(
        event.document.languageId
      )
    ) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        event.waitUntil(
          (async () => {
            isInternalSave = true;
            try {
              // Only process the import section
              const importSection = findImportSection(event.document);
              if (importSection) {
                const { start, end, text } = importSection;
                const sortedText = sortAndFormatImports(text);
                
                if (sortedText !== text) {
                  const range = new vscode.Range(
                    event.document.positionAt(start),
                    event.document.positionAt(end)
                  );
                  return [new vscode.TextEdit(range, sortedText)];
                }
              }
            } finally {
              isInternalSave = false;
            }
            return [];
          })()
        );
      }
    }
  });

  context.subscriptions.push(disposable, saveDisposable);
}

interface ImportSection {
  start: number;
  end: number;
  text: string;
}

function findImportSection(document: vscode.TextDocument): ImportSection | null {
  const text = document.getText();
  const lines = text.split("\n");
  
  let importStart: number | null = null;
  let importEnd: number | null = null;
  let currentPos = 0;
  let inComment = false;
  let inMultilineImport = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Handle multi-line comments
    if (trimmedLine.startsWith("/*")) {
      inComment = true;
    }
    if (trimmedLine.endsWith("*/")) {
      inComment = false;
      currentPos += line.length + 1;
      continue;
    }
    if (inComment) {
      currentPos += line.length + 1;
      continue;
    }

    // Skip single-line comments
    if (trimmedLine.startsWith("//")) {
      currentPos += line.length + 1;
      continue;
    }

    // Track import statements
    if (trimmedLine.startsWith("import")) {
      if (importStart === null) {
        importStart = currentPos;
      }
      inMultilineImport = true;
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    } else if (inMultilineImport) {
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    }

    if (inMultilineImport && (braceCount === 0 || trimmedLine.endsWith(";"))) {
      inMultilineImport = false;
      importEnd = currentPos + line.length;
    }

    // If we find non-import code after imports, stop
    if (!inMultilineImport && !trimmedLine.startsWith("import") && trimmedLine !== "") {
      if (importStart !== null) {
        break;
      }
    }

    currentPos += line.length + 1;
  }

  if (importStart !== null && importEnd !== null) {
    return {
      start: importStart,
      end: importEnd,
      text: text.substring(importStart, importEnd)
    };
  }

  return null;
}

async function formatImports(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const importSection = findImportSection(document);
  
  if (importSection) {
    const sortedText = sortAndFormatImports(importSection.text);
    
    if (sortedText !== importSection.text) {
      await editor.edit((editBuilder: vscode.TextEditorEdit) => {
        const range = new vscode.Range(
          document.positionAt(importSection.start),
          document.positionAt(importSection.end)
        );
        editBuilder.replace(range, sortedText);
      });
    }
  }
}

function sortAndFormatImports(text: string): string {
  const lines = text.split("\n");
  const importBlocks: ImportBlock[] = [];
  let currentBlock: ImportBlock = {
    imports: [],
    precedingComments: [],
    blankLinesBefore: 0
  };
  
  let currentImport: ImportItem | null = null;
  let isInImport = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === "") {
      if (currentImport === null) {
        currentBlock.blankLinesBefore++;
      }
      continue;
    }
    
    // Handle comments
    if (line.startsWith("//") || line.startsWith("/*")) {
      if (currentImport) {
        currentImport.comments.push(line);
      } else {
        currentBlock.precedingComments.push(line);
      }
      continue;
    }
    
    if (line.startsWith("import")) {
      if (currentImport) {
        currentBlock.imports.push(currentImport);
      }
      
      isInImport = true;
      currentImport = {
        original: line,
        normalized: line.replace(/\s+/g, " "),
        startLine: i,
        endLine: i,
        comments: []
      };
      
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && line.endsWith(";")) {
        currentBlock.imports.push(currentImport);
        currentImport = null;
        isInImport = false;
      }
    } else if (isInImport && currentImport) {
      currentImport.original += "\n" + line;
      currentImport.normalized += " " + line.replace(/\s+/g, " ");
      currentImport.endLine = i;
      
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && line.includes(";")) {
        currentBlock.imports.push(currentImport);
        currentImport = null;
        isInImport = false;
      }
    }
  }
  
  if (currentImport) {
    currentBlock.imports.push(currentImport);
  }
  
  // Group imports
  const packageImports: ImportItem[] = [];
  const atImports: ImportItem[] = [];
  const relativeImports: ImportItem[] = [];
  
  currentBlock.imports.forEach((item) => {
    if (item.normalized.includes("'@") || item.normalized.includes('"@')) {
      atImports.push(item);
    } else if (item.normalized.includes("./") || item.normalized.includes("../")) {
      relativeImports.push(item);
    } else {
      packageImports.push(item);
    }
  });
  
  // Sort imports within their groups
  const sortImports = (imports: ImportItem[]): string[] => {
    return imports
      .sort((a, b) => a.normalized.localeCompare(b.normalized))
      .map(item => {
        const comments = item.comments.length > 0 
          ? item.comments.join("\n") + "\n"
          : "";
        return comments + item.original;
      });
  };
  
  // Build the final text
  const importGroups: string[] = [];
  
  if (currentBlock.precedingComments.length > 0) {
    importGroups.push(...currentBlock.precedingComments);
  }
  
  if (packageImports.length) {
    if (importGroups.length > 0) {importGroups.push("");}
    importGroups.push(...sortImports(packageImports));
  }
  
  if (atImports.length) {
    if (importGroups.length > 0) {importGroups.push("");}
    importGroups.push(...sortImports(atImports));
  }
  
  if (relativeImports.length) {
    if (importGroups.length > 0) {importGroups.push("");}
    importGroups.push(...sortImports(relativeImports));
  }
  
  return importGroups.join("\n");
}

export function deactivate(): void {}