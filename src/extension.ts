import * as vscode from "vscode";

interface ImportItem {
  original: string;
  normalized: string;
  startLine: number;
  endLine: number;
  comments: string[];
  length: number;
}

interface ImportBlock {
  imports: ImportItem[];
  precedingComments: string[];
  blankLinesBefore: number;
}

interface ImportSection {
  start: number;
  end: number;
  text: string;
}

interface ImportSorterConfig {
  importOrder: ("package" | "scoped" | "relative")[];
  sortBy: "alphabetical" | "length-asc" | "length-desc";
  removeUnused: boolean;
  emptyLineBetweenGroups: boolean;
  maxLineLength: number;
  groupByScope: boolean;
  preserveLeadingComments: boolean;
  wrapMultilineImports: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ImportSorterConfig = {
  importOrder: ["package", "scoped", "relative"],
  sortBy: "alphabetical",
  removeUnused: false,
  emptyLineBetweenGroups: true,
  maxLineLength: 80,
  groupByScope: true,
  preserveLeadingComments: true,
  wrapMultilineImports: true
};

function loadConfiguration(): ImportSorterConfig {
  const config = vscode.workspace.getConfiguration("importSorter");
  return {
    importOrder: config.get("importOrder", DEFAULT_CONFIG.importOrder),
    sortBy: config.get("sortBy", DEFAULT_CONFIG.sortBy),
    removeUnused: config.get("removeUnused", DEFAULT_CONFIG.removeUnused),
    emptyLineBetweenGroups: config.get("emptyLineBetweenGroups", DEFAULT_CONFIG.emptyLineBetweenGroups),
    maxLineLength: config.get("maxLineLength", DEFAULT_CONFIG.maxLineLength),
    groupByScope: config.get("groupByScope", DEFAULT_CONFIG.groupByScope),
    preserveLeadingComments: config.get("preserveLeadingComments", DEFAULT_CONFIG.preserveLeadingComments),
    wrapMultilineImports: config.get("wrapMultilineImports", DEFAULT_CONFIG.wrapMultilineImports)
  };
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
    const config = loadConfiguration();
    const sortedText = sortAndFormatImports(importSection.text, config);
    
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

async function removeUnusedImports(text: string, document: vscode.TextDocument): Promise<string> {
  try {
    // Get diagnostics for the file
    const diagnostics = await vscode.commands.executeCommand<vscode.Diagnostic[]>(
      "typescript.executeWorkspaceSymbolProvider",
      document.uri.toString()
    );

    if (!diagnostics) {
      return text;
    }

    const unusedImports = diagnostics.filter(
      d => d.message.includes("is declared but never used")
    );

    const lines = text.split("\n");
    const newLines = lines.filter(line => {
      const trimmed = line.trim();
      return !unusedImports.some(diag => 
        trimmed.includes(diag.message.split("'")[1])
      );
    });

    return newLines.join("\n");
  } catch (error) {
    console.error("Error removing unused imports:", error);
    return text;
  }
}

function wrapLongImport(importStatement: string, maxLength: number): string {
  if (importStatement.length <= maxLength) {
    return importStatement;
  }

  const match = importStatement.match(/^(import\s*{)([^}]+)(}.*)$/);
  if (!match) {
    return importStatement;
  }

  const [, start, members, end] = match;
  const items = members.split(",").map(s => s.trim());
  
  return `${start}\n  ${items.join(",\n  ")}\n${end}`;
}

function sortImportsByConfig(imports: ImportItem[], config: ImportSorterConfig): ImportItem[] {
  let sorted = [...imports];

  switch (config.sortBy) {
    case "length-asc":
      sorted.sort((a, b) => a.length - b.length);
      break;
    case "length-desc":
      sorted.sort((a, b) => b.length - a.length);
      break;
    case "alphabetical":
    default:
      sorted.sort((a, b) => a.normalized.localeCompare(b.normalized));
  }

  return sorted;
}

function sortAndFormatImports(text: string, config: ImportSorterConfig): string {
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
  
  // Parse imports and collect metadata
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine === "") {
      if (currentImport === null) {
        currentBlock.blankLinesBefore++;
      }
      continue;
    }
    
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*")) {
      if (currentImport) {
        currentImport.comments.push(line);
      } else if (config.preserveLeadingComments) {
        currentBlock.precedingComments.push(line);
      }
      continue;
    }
    
    if (trimmedLine.startsWith("import")) {
      if (currentImport) {
        currentBlock.imports.push(currentImport);
      }
      
      isInImport = true;
      currentImport = {
        original: line,
        normalized: line.replace(/\s+/g, " "),
        startLine: i,
        endLine: i,
        comments: [],
        length: line.length
      };
      
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && trimmedLine.endsWith(";")) {
        currentBlock.imports.push(currentImport);
        currentImport = null;
        isInImport = false;
      }
    } else if (isInImport && currentImport) {
      currentImport.original += "\n" + line;
      currentImport.normalized += " " + trimmedLine.replace(/\s+/g, " ");
      currentImport.endLine = i;
      currentImport.length += line.length;
      
      braceCount += (trimmedLine.match(/{/g) || []).length - (trimmedLine.match(/}/g) || []).length;
      
      if (braceCount === 0 && trimmedLine.includes(";")) {
        currentBlock.imports.push(currentImport);
        currentImport = null;
        isInImport = false;
      }
    }
  }
  
  if (currentImport) {
    currentBlock.imports.push(currentImport);
  }

  // Sort imports based on configuration
  const importGroups: Record<string, ImportItem[]> = {
    package: [],
    scoped: [],
    relative: []
  };

  currentBlock.imports.forEach((item) => {
    if (item.normalized.includes("'@") || item.normalized.includes('"@')) {
      importGroups.scoped.push(item);
    } else if (item.normalized.includes("./") || item.normalized.includes("../")) {
      importGroups.relative.push(item);
    } else {
      importGroups.package.push(item);
    }
  });

  // Sort each group according to config
  Object.keys(importGroups).forEach(key => {
    importGroups[key] = sortImportsByConfig(importGroups[key], config);
  });

  // Build final output
  const output: string[] = [];
  
  if (config.preserveLeadingComments && currentBlock.precedingComments.length > 0) {
    output.push(...currentBlock.precedingComments);
  }

  // Add imports in configured order
  config.importOrder.forEach((groupType, index) => {
    const group = importGroups[groupType];
    if (group.length > 0) {
      if (config.emptyLineBetweenGroups && output.length > 0) {
        output.push("");
      }

      group.forEach(item => {
        const comments = item.comments.length > 0 
          ? item.comments.join("\n") + "\n"
          : "";
        
        let importText = item.original;
        if (config.wrapMultilineImports) {
          importText = wrapLongImport(importText, config.maxLineLength);
        }
        
        output.push(comments + importText);
      });
    }
  });

  return output.join("\n");
}

export function activate(context: vscode.ExtensionContext) {
  // Register configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("importSorter")) {
        loadConfiguration();
      }
    })
  );

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
  
  const saveDisposable = vscode.workspace.onWillSaveTextDocument(async (event: vscode.TextDocumentWillSaveEvent) => {
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
              const importSection = findImportSection(event.document);
              if (importSection) {
                const config = loadConfiguration();
                let { start, end, text } = importSection;
                
                // Remove unused imports if enabled
                if (config.removeUnused) {
                  text = await removeUnusedImports(text, event.document);
                }
                
                const sortedText = sortAndFormatImports(text, config);
                
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

export function deactivate(): void {}