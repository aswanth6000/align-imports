# Changelog: Import Management Tool  

## [v0.0.5] - 2024-12-31  
### Added  
- **Configurable Import Order**:  
  - Ability to specify the order of import groups:  
    - Package imports (e.g., `import React from "react"`).  
    - Scoped imports (e.g., `import { Button } from "@/components/ui/button"`).  
    - Relative imports (e.g., `import MyComponent from "./MyComponent"`).  
  - Fully customizable through VS Code settings.  

- **Sort Options**:  
  - Added support for sorting imports in different ways:  
    - Alphabetical (default).  
    - Length ascending.  
    - Length descending.  

- **Unused Import Removal**:  
  - Optional feature to automatically detect and remove unused imports.  
  - Integrated with TypeScript/JavaScript language service for accuracy.  

- **Additional Settings**:  
  - Configurable options for fine-tuning import organization:  
    - Maximum line length for wrapping long imports.  
    - Empty lines between import groups for better readability.  
    - Preservation of comments within imports.  
    - Multi-line import wrapping for long imports.  
    - Grouping by scope for relevance-based import organization.  

- **Enhanced Formatting**:  
  - Intelligent line wrapping for long imports.  
  - Preserved spacing and comments for consistent formatting.  
  - Configurable line breaks between groups for improved structure.  

### Why It Matters  
- **Improves Readability**: Clean and consistent import structure.  
- **Saves Time**: Automates import sorting, grouping, and removal of unused imports.  
- **Highly Customizable**: Tailored to match your team’s coding standards.  

---

### Getting Started  
1. Install the tool as a VS Code extension.  
2. Customize settings via `settings.json` or the VS Code settings UI.  
3. Save files to automatically sort, format, and organize imports!  

---

Enjoy a cleaner and more maintainable codebase with these powerful import management enhancements!  
