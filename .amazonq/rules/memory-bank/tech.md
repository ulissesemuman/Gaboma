# Technology Stack

## Programming Languages

### JavaScript (ES6+)
- **Version**: ES2015+ (ES6 modules, async/await, arrow functions, destructuring)
- **Runtime**: Browser-native (no Node.js required for runtime)
- **Module System**: ES6 modules with `import`/`export`
- **Features Used**:
  - Async/await for asynchronous operations
  - Template literals for string interpolation
  - Destructuring for cleaner code
  - Arrow functions for concise syntax
  - Optional chaining (`?.`) for safe property access
  - Nullish coalescing (`??`) for default values
  - Spread operator for object/array manipulation

### HTML5
- **Version**: HTML5
- **Features Used**:
  - Semantic elements (`<main>`, `<header>`, `<footer>`)
  - Data attributes for state management
  - ARIA attributes for accessibility
  - Local storage API for persistence

### CSS3
- **Version**: CSS3
- **Features Used**:
  - CSS Grid and Flexbox for layouts
  - CSS Variables (custom properties) for theming
  - CSS animations and transitions
  - Media queries for responsive design
  - CSS modules pattern (separate files per component)

## Core Technologies

### No Build System
- **Zero bundler**: Runs directly in browser without webpack/vite/parcel
- **No transpilation**: Uses native ES6+ features supported by modern browsers
- **No package manager**: No npm/yarn dependencies for runtime
- **Direct file serving**: Can be served with any static file server

### Browser APIs
- **localStorage**: Game state persistence
- **fetch API**: Loading JSON data (books, chapters, translations)
- **DOM API**: Dynamic UI rendering and manipulation
- **CSS Object Model**: Dynamic style manipulation for themes
- **History API**: Potential for navigation management

### External Dependencies
- **Google Fonts API**: Dynamic font loading
  - URL: `https://fonts.googleapis.com/css2`
  - Configured via `assets/fonts.json`
  - Loaded dynamically based on book preferences

## Data Formats

### JSON
All configuration and content uses JSON:
- **Book manifests**: `book.json` files
- **Story chapters**: `chapter-*.json` files
- **Translations**: Language JSON files
- **Configuration**: `index.json` files for registries

### JSON Schema Patterns
```javascript
// Book Manifest
{
  "manifestVersion": "1.0.0",
  "id": "book-id",
  "title": "Book Title",
  "languages": ["en-us", "pt-br"],
  "defaultLanguage": "pt-br",
  "dice": { "count": 2, "sides": 6 },
  "home": { "showTitle": true, "cover": {...} }
}

// Chapter Structure
{
  "id": "chapter-001",
  "content": "Story text with {{variables}}",
  "choices": [
    {
      "text": "Choice text",
      "target": "chapter-002",
      "conditions": [...],
      "effects": [...]
    }
  ]
}

// Translation File
{
  "key.path": "Translated text with {param}",
  "nested.key": "Value"
}
```

## Development Setup

### Prerequisites
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Text Editor**: Any code editor (VS Code, Sublime, Atom, etc.)
- **Local Server**: Optional but recommended for development
  - Python: `python -m http.server 8000`
  - Node.js: `npx http-server`
  - VS Code: Live Server extension

### Project Setup
```bash
# Clone repository
git clone https://github.com/ulissesemuman/Gaboma.git

# Navigate to project
cd Gaboma/alpha_0.02

# Serve locally (choose one)
python -m http.server 8000
# OR
npx http-server -p 8000

# Open browser
# Navigate to http://localhost:8000
```

### File Organization
- No build step required
- Edit files directly
- Refresh browser to see changes
- Use browser DevTools for debugging

## Development Commands

### Local Development
```bash
# Serve with Python 3
python -m http.server 8000

# Serve with Python 2
python -m SimpleHTTPServer 8000

# Serve with Node.js http-server
npx http-server -p 8000 -c-1

# Serve with PHP
php -S localhost:8000
```

### Testing
- **Manual Testing**: Open in browser and interact
- **Console Debugging**: Use browser DevTools console
- **Debug Panel**: Built-in debug panel in application (accessible via UI)
- **State Inspection**: Check localStorage in DevTools

### Deployment
```bash
# GitHub Pages (automatic)
# Push to main branch, enable GitHub Pages in repo settings

# Manual deployment
# Copy all files to web server
# Ensure MIME types are correct for .js files
```

## Browser Compatibility

### Minimum Requirements
- **Chrome**: 90+ (April 2021)
- **Firefox**: 88+ (April 2021)
- **Safari**: 14+ (September 2020)
- **Edge**: 90+ (April 2021)

### Required Features
- ES6 modules (`<script type="module">`)
- Async/await
- Fetch API
- localStorage
- CSS Grid and Flexbox
- CSS Custom Properties
- Optional chaining and nullish coalescing

### Not Supported
- Internet Explorer (any version)
- Legacy browsers without ES6 module support

## Performance Considerations

### Loading Strategy
- **Lazy loading**: Books and chapters loaded on demand
- **Caching**: Browser caches static assets
- **Minimal dependencies**: No large frameworks or libraries
- **Small footprint**: Engine code is lightweight (~50KB total)

### State Management
- **localStorage**: Synchronous but fast for small data
- **JSON parsing**: Minimal overhead for chapter data
- **DOM updates**: Efficient re-rendering of only changed elements

### Asset Optimization
- **Fonts**: Loaded from Google Fonts CDN with caching
- **Images**: Book covers should be optimized (WebP recommended)
- **CSS**: Modular CSS files loaded as needed
- **JavaScript**: Native modules with browser caching

## Development Tools

### Recommended Extensions (VS Code)
- **Live Server**: Auto-reload on file changes
- **ESLint**: JavaScript linting (optional)
- **Prettier**: Code formatting (optional)
- **JSON Tools**: JSON validation and formatting

### Browser DevTools
- **Console**: Error tracking and debugging
- **Network**: Monitor fetch requests
- **Application**: Inspect localStorage
- **Elements**: CSS debugging and inspection
- **Sources**: JavaScript debugging with breakpoints

## Version Control
- **Git**: Version control system
- **GitHub**: Repository hosting and GitHub Pages deployment
- **Branching**: Feature branches recommended
- **Commits**: Atomic commits with clear messages
