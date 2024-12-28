# Align Imports Plus Extension for VS Code

A Visual Studio Code extension that automatically formats and organizes JavaScript/TypeScript import statements. It groups imports into three categories (package, @-prefixed, and relative imports) and maintains proper spacing between groups.

## Features

- Automatically formats imports on file save
- Groups imports into three categories:
  1. Package imports (e.g., `import React from 'react'`)
  2. @-prefixed imports (e.g., `import { Button } from '@/components/ui/button'`)
  3. Relative imports (e.g., `import { utils } from './utils'`)
- Maintains proper spacing between import groups
- Preserves multi-line import formatting
- Removes duplicate imports
- Works with JavaScript, TypeScript, and React files
- Supports both manual triggering and automatic formatting on save

## Installation

1. Open VS Code
2. Press `Ctrl+P` (`Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install import-formatter` and press Enter
4. Restart VS Code

## Usage

The extension works in two ways:

1. **Automatic Formatting**: Your imports will be automatically formatted whenever you save a JavaScript or TypeScript file.

2. **Manual Formatting**: You can manually format imports using:
   - Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`): Type "Format Imports"
   - Or assign a custom keyboard shortcut

## Example

Before:
```typescript
import { Button } from './components/Button';
import React from 'react';
import { Something } from '@/components/Something';
import { useState } from 'react';
import { Utils } from '../utils';
```

After:
```typescript
import React from 'react';
import { useState } from 'react';

import { Something } from '@/components/Something';

import { Button } from './components/Button';
import { Utils } from '../utils';
```

## Supported File Types

- JavaScript (.js)
- TypeScript (.ts)
- React JavaScript (.jsx)
- React TypeScript (.tsx)

## Configuration

The extension works out of the box with no configuration needed.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Issues and Feedback

If you find any bugs or have suggestions for improvements, please file an issue on the GitHub repository.