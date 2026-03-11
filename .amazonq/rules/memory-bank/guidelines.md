# Development Guidelines

## Code Quality Standards

### File Structure and Organization
- **One module per file**: Each file exports a single primary object/function
- **Explicit exports**: Use named exports wrapped in objects (e.g., `export const Conditions = { evaluate }`)
- **ES6 imports**: Always use explicit import statements at the top of files
- **Relative paths**: Import local modules with relative paths including `.js` extension
- **Logical grouping**: Group related functionality in subdirectories (flow/, ui/, utils/)

### Naming Conventions
- **Files**: camelCase for filenames (e.g., `fetchUtils.js`, `feedbackManager.js`)
- **Modules**: PascalCase for exported module objects (e.g., `FetchUtils`, `Conditions`, `TextManager`)
- **Functions**: camelCase for function names (e.g., `evaluate`, `fetchJSON`, `showChapterFeedback`)
- **Variables**: camelCase for variables (e.g., `messageKeyOrText`, `extraContext`)
- **Constants**: camelCase for most constants, UPPER_SNAKE_CASE for true constants (e.g., `operatorMap`)
- **Private functions**: Prefix with underscore for internal helpers (e.g., `_effectiveMax`, `_applyItemHook`)

### Code Formatting
- **Indentation**: 2 spaces (consistent across all files)
- **Line endings**: CRLF (Windows-style `\r\n`)
- **Semicolons**: Always use semicolons to terminate statements
- **Quotes**: Double quotes for strings (e.g., `"error.failedToLoad"`)
- **Braces**: Always use braces for control structures, even single-line blocks
- **Spacing**: Space after keywords (if, for, while), no space before function parentheses

### Documentation Standards
- **Inline comments**: Use `//` for single-line explanatory comments
- **Section headers**: Use decorative comment separators for major sections
  ```javascript
  // ── Logical combinators ────────────────────────────────────────────
  ```
- **JSDoc**: Use JSDoc-style comments for complex functions
  ```javascript
  /**
   * Returns the effective max for a variable:
   * progress.varMaxOverrides[id] > story.variables[id].max > Infinity
   */
  ```
- **Emoji annotations**: Use emoji in comments for visual clarity (e.g., `// 1️⃣ Resolver texto`)
- **Minimal comments**: Code should be self-documenting; comment only complex logic

## Semantic Patterns

### Module Export Pattern
All modules follow a consistent export pattern:
```javascript
// Define internal functions
function internalFunction() { /* ... */ }

// Export as named object
export const ModuleName = {
  publicMethod: internalFunction,
  anotherMethod
};
```

**Frequency**: 5/5 files analyzed
**Examples**: `Conditions`, `FetchUtils`, `dice`

### Async/Await Error Handling
Async functions use try-catch or propagate errors to caller:
```javascript
async function initApp() {
  await UIManager.init();
  window._gaboma = { BookLoader };
}

initApp().catch(error => {
  console.error("Error loading app:", error);
});
```

**Frequency**: 3/5 files analyzed
**Pattern**: Top-level async calls always have `.catch()` handlers

### Conditional Early Returns
Functions return early for null/undefined/empty cases:
```javascript
export function evaluate(condition, context) {
  if (!condition) return true;
  
  const normalized = normalize(condition);
  if (!normalized) return true;
  
  // Main logic continues...
}
```

**Frequency**: 4/5 files analyzed
**Benefit**: Reduces nesting and improves readability

### Recursive Pattern for Tree Structures
Recursive functions handle nested data structures:
```javascript
function normalize(condition) {
  if (!condition) return null;
  
  if (condition.all) {
    return { all: condition.all.map(normalize) };
  }
  
  if (condition.not) {
    return { not: normalize(condition.not) };
  }
  
  // Base case
  return condition;
}
```

**Frequency**: 2/5 files analyzed
**Use case**: Conditions, expressions, nested configurations

### Nullish Coalescing for Defaults
Use `??` operator for default values:
```javascript
const extra = book?.manifest?.extraFonts ?? [];
const font = state.uiFont || state.defaultUIFont;
```

**Frequency**: 5/5 files analyzed
**Pattern**: Prefer `??` for null/undefined, `||` for falsy values

### Optional Chaining for Safe Access
Use `?.` for potentially undefined nested properties:
```javascript
const bookState = state.bookState?.[bookId];
const varDef = story?.variables?.[effect.id];
```

**Frequency**: 5/5 files analyzed
**Pattern**: Always use when accessing nested properties that may not exist

## Internal API Usage

### State Management
```javascript
import state from "../core/state.js";

// Read state
const bookState = state.bookState[bookId];
const currentView = state.currentView;

// Modify state
bookState.progress.variables[varId] = newValue;
state.uiFont = fontId;

// Persist changes
state.save();
```

**Pattern**: Always call `state.save()` after modifications

### Translation System
```javascript
import { t } from "../i18n/globalI18n.js";

// Simple translation
const message = t("error.failedToLoad");

// Translation with parameters
const error = t("error.failedToLoad", { path });
```

**Pattern**: Use `t()` for global UI, `tb()` for book-specific text

### Fetch Utilities
```javascript
import { FetchUtils } from "../utils/fetchUtils.js";

// Required resource
const data = await FetchUtils.fetchJSON("path/to/file.json");

// Optional resource (returns null if 404)
const optional = await FetchUtils.fetchJSONOptional("path/to/file.json");
```

**Pattern**: Use `fetchJSON` for required files, `fetchJSONOptional` for optional files

### Text Rendering
```javascript
import { TextManager } from "./textManager.js";

// Interpolate variables in text
const rendered = TextManager.interpolateVariables(text, context);
```

**Pattern**: Always interpolate variables before displaying user-facing text

### UI Event Registration
```javascript
import { registerVisualEvent } from "./uiManager.js";

// Register visual event for history
registerVisualEvent({
  type: "message",
  text: "Event description"
});
```

**Pattern**: Register all visual events for history tracking

## Common Code Idioms

### Object Destructuring in Parameters
```javascript
export function roll({ count, sides }) {
  // Use count and sides directly
}
```

**Frequency**: 3/5 files analyzed

### Array Methods for Iteration
```javascript
// map for transformation
const families = fonts.map(f => f.name.trim());

// filter for selection
const font = data["google-fonts"].find(f => f.id === fontId);

// every/some for boolean checks
return normalized.all.every(cond => evaluate(cond, context));
```

**Frequency**: 5/5 files analyzed
**Pattern**: Prefer functional array methods over for loops

### Template Literals for Strings
```javascript
const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
throw new Error(`Unknown effect: ${effect.type}`);
```

**Frequency**: 4/5 files analyzed

### Ternary Operators for Simple Conditionals
```javascript
const font = bookState?.font ?? state.uiFont ?? state.defaultUIFont;
const text = res.status === 404 ? null : await res.json();
```

**Frequency**: 5/5 files analyzed

### Object Spread for Merging
```javascript
return {
  "google-fonts": [...extra, ...base["google-fonts"]]
};
```

**Frequency**: 3/5 files analyzed

## Error Handling Patterns

### Throw Errors with Context
```javascript
if (!res.ok) {
  throw new Error(t("error.failedToLoad", { path }));
}

if (!font) {
  throw new Error("getFontsList: " + t("error.bookNotFound", { bookId }));
}
```

**Pattern**: Always include context (path, ID, etc.) in error messages

### Console Warnings for Non-Fatal Issues
```javascript
if (!itemDef) {
  console.warn(`[Gaboma] equipItem: unknown item "${itemId}"`);
  break;
}
```

**Pattern**: Use `console.warn()` for recoverable issues, prefix with `[Gaboma]`

### Graceful Degradation
```javascript
function renderFeedback(text) {
  const container = document.getElementById("chapter-feedback");
  if (!container) return; // Fail silently if element missing
  
  // Continue with rendering
}
```

**Pattern**: Check for DOM elements before manipulation, fail gracefully

## DOM Manipulation Patterns

### Element Creation and Styling
```javascript
const msg = document.createElement("div");
msg.className = "chapter-feedback-message";
msg.textContent = text;
container.appendChild(msg);
```

**Pattern**: Create, configure, then append

### Timed Animations
```javascript
setTimeout(() => {
  msg.classList.add("fade-out");
  setTimeout(() => msg.remove(), 300);
}, 4000);
```

**Pattern**: Use nested setTimeout for animation sequences

### Dynamic Style Application
```javascript
document.body.style.fontFamily = `"${font.name}", serif`;
```

**Pattern**: Apply styles directly to elements when dynamic

## Data Validation Patterns

### Type Checking
```javascript
if (typeof current === "boolean") break;
```

**Pattern**: Check types before operations that assume specific types

### Existence Checks
```javascript
if (!condition) return true;
if (keys.length === 0) return null;
```

**Pattern**: Check for null/undefined/empty before processing

### Boundary Validation
```javascript
const clampMin = varDef?.min !== undefined ? varDef.min : -Infinity;
const clampMax = _effectiveMax(bookState, story, effect.id);
bookState.progress.variables[effect.id] = Math.min(clampMax, Math.max(clampMin, raw));
```

**Pattern**: Always clamp numeric values to defined ranges

## Performance Considerations

### Lazy Loading
- Load books and chapters on demand, not at startup
- Use `fetchJSONOptional` for optional resources
- Cache loaded data in state

### Minimal DOM Updates
- Batch DOM changes when possible
- Use `textContent` instead of `innerHTML` for plain text
- Remove elements after animations complete

### Efficient Lookups
```javascript
const operatorMap = {
  min: "gte",
  max: "lte",
  exactly: "eq"
};
```

**Pattern**: Use object maps for constant-time lookups instead of if/else chains

## Testing and Debugging

### Debug Logging
```javascript
console.error("Error loading app:", error);
console.warn(`[Gaboma] Item hook: unsupported effect type "${eff.type}"`);
```

**Pattern**: Use appropriate log levels, include context

### Global Debug Access
```javascript
window._gaboma = { BookLoader };
```

**Pattern**: Expose key modules to window for console debugging

### Validation Messages
```javascript
if (!itemDef) {
  console.warn(`[Gaboma] equipItem: unknown item "${itemId}"`);
  break;
}
```

**Pattern**: Validate data and warn about issues during development

## Accessibility Considerations

### ARIA Attributes
```html
<div id="dialog-overlay" class="dialog-overlay" aria-hidden="true">
  <div id="dialog-box" role="dialog" aria-modal="true" 
       aria-labelledby="dialog-title" 
       aria-describedby="dialog-message">
```

**Pattern**: Use ARIA attributes for dynamic UI components

### Semantic HTML
- Use semantic elements (`<main>`, `<header>`, `<footer>`)
- Provide meaningful IDs and classes
- Ensure keyboard navigation support

## Security Practices

### Safe Text Rendering
```javascript
msg.textContent = text; // Not innerHTML
```

**Pattern**: Use `textContent` to prevent XSS attacks

### Input Validation
- Validate all user input before processing
- Check types and ranges for numeric values
- Sanitize data from external sources

## Code Review Checklist

Before committing code, ensure:
- [ ] All imports include `.js` extension
- [ ] Functions follow naming conventions (camelCase)
- [ ] Modules export as named objects (PascalCase)
- [ ] Error handling is present for async operations
- [ ] State changes are followed by `state.save()`
- [ ] DOM elements are checked before manipulation
- [ ] Translation keys are used for user-facing text
- [ ] Console warnings include `[Gaboma]` prefix
- [ ] Code is formatted with 2-space indentation
- [ ] No unused imports or variables
- [ ] Comments explain complex logic, not obvious code
