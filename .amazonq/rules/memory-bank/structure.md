# Project Structure

## Directory Organization

```
alpha_0.02/
├── assets/                    # Global assets
│   └── fonts.json            # Font definitions for Google Fonts
├── books/                     # Story content library
│   ├── index.json            # Registry of available books
│   ├── eldenmoor/            # Example book
│   ├── dark-forest-1/        # Example book
│   ├── dark-forest-2/        # Example book
│   └── void-heir-01/         # Example book
├── engine/                    # Core engine modules
│   ├── combat/               # Combat system
│   ├── core/                 # Core engine logic
│   ├── data/                 # Data loading and assembly
│   ├── flow/                 # Game flow and logic
│   ├── i18n/                 # Internationalization
│   ├── ui/                   # User interface components
│   └── utils/                # Utility functions
├── language/                  # Global UI translations
│   ├── index.json            # Language registry
│   ├── en-us.json            # English translations
│   └── pt-br.json            # Portuguese translations
├── style/                     # Global stylesheets
│   ├── base.css              # Base styles
│   ├── combat.css            # Combat UI styles
│   ├── config.css            # Configuration panel styles
│   ├── debug.css             # Debug panel styles
│   ├── dialog.css            # Dialog modal styles
│   ├── dice.css              # Dice animation styles
│   ├── feedback.css          # Feedback system styles
│   ├── library.css           # Library view styles
│   └── reader.css            # Reader view styles
├── index.html                 # Application entry point
├── loader.js                  # Application bootstrapper
├── style.css                  # Main stylesheet import
└── README.md                  # Project documentation
```

## Book Structure

Each book follows a standardized structure:

```
books/{book-id}/
├── book.json                  # Book manifest and configuration
├── style.css                  # Book-specific styles (optional)
├── assets/                    # Book assets
│   ├── cover.png             # Front cover image
│   └── back-cover.png        # Back cover image (optional)
├── language/                  # Book translations
│   ├── en-us.json            # English story text
│   └── pt-br.json            # Portuguese story text
└── story/                     # Story chapters
    ├── chapter-001.json      # Chapter files
    ├── chapter-002.json
    └── ...
```

## Core Components

### Engine Core (`engine/core/`)
- **state.js**: Global state management with localStorage persistence
- **engine.js**: Effect application and game logic execution
- **reader.js**: Story reading and chapter navigation

### Data Layer (`engine/data/`)
- **bookLoader.js**: Book manifest loading and validation
- **storyAssembler.js**: Chapter assembly and story compilation

### Flow Control (`engine/flow/`)
- **actionResolver.js**: Resolves player actions and choice outcomes
- **chapterResolver.js**: Determines next chapter based on conditions
- **conditions.js**: Evaluates conditional expressions (variables, items, flags)
- **dice.js**: Dice rolling mechanics and probability
- **effects.js**: Effect validation and preprocessing
- **expressions.js**: Expression parser for dynamic values
- **history.js**: Tracks player choices and visited chapters

### Combat System (`engine/combat/`)
- **combatEngine.js**: Turn-based combat logic
- **enemyRegistry.js**: Enemy definitions and combat AI

### User Interface (`engine/ui/`)
- **uiManager.js**: Main UI orchestrator and view management
- **fontManager.js**: Font loading and application
- **themeManager.js**: Theme switching and persistence
- **textManager.js**: Text rendering and formatting
- **dialogManager.js**: Modal dialog system
- **feedbackManager.js**: Visual feedback for game events
- **feedbackResolver.js**: Feedback message generation
- **combatModal.js**: Combat UI overlay
- **diceAnimator.js**: Dice roll animations
- **messageAnimator.js**: Text animation effects
- **debugPanel.js**: Development and testing tools

### Internationalization (`engine/i18n/`)
- **globalI18n.js**: Global UI translation system
- **bookI18n.js**: Book-specific translation system

### Utilities (`engine/utils/`)
- **fetchUtils.js**: HTTP request wrapper with error handling
- **i18nUtils.js**: Translation helper functions
- **objectUtils.js**: Object manipulation utilities

## Architectural Patterns

### Module System
- ES6 modules with explicit imports/exports
- No bundler required - runs natively in modern browsers
- Singleton pattern for managers (UIManager, FontManager, ThemeManager)

### State Management
- Centralized state in `state.js` with localStorage persistence
- Immutable state updates with explicit save() calls
- Per-book state isolation with global UI state

### Data Flow
1. **Initialization**: loader.js → UIManager.init() → Load books and UI
2. **Book Selection**: User clicks book → BookLoader.loadBook() → Render book home
3. **Story Start**: User starts reading → Reader.loadChapter() → Render chapter
4. **Choice Selection**: User clicks choice → ActionResolver.resolve() → Apply effects → Load next chapter
5. **State Persistence**: After each action → state.save() → localStorage

### Component Communication
- **Event-driven**: UI components emit events, managers listen and respond
- **Direct calls**: Managers expose public APIs for common operations
- **State observation**: Components read from centralized state

### Separation of Concerns
- **Engine**: Pure game logic, no DOM manipulation
- **UI**: DOM manipulation and rendering, minimal logic
- **Data**: Loading and parsing, no business logic
- **Flow**: Decision-making and branching, delegates to engine

## Key Relationships

```
loader.js
  └─> UIManager.init()
       ├─> BookLoader.loadBookList()
       ├─> FontManager.loadGoogleFonts()
       ├─> ThemeManager.applyTheme()
       └─> Render library view

User selects book
  └─> BookLoader.loadBook(bookId)
       ├─> Fetch book.json
       ├─> StoryAssembler.assembleStory()
       │    └─> Fetch all chapters and merge
       ├─> BookI18n.init()
       └─> Render book home

User starts reading
  └─> Reader.loadChapter(chapterId)
       ├─> ChapterResolver.resolve()
       ├─> Conditions.evaluate()
       ├─> TextManager.render()
       └─> Display choices

User makes choice
  └─> ActionResolver.resolve(action)
       ├─> Effects.validate()
       ├─> Engine.applyEffects()
       │    ├─> Update variables
       │    ├─> Modify inventory
       │    └─> Check fatal conditions
       ├─> History.record()
       ├─> FeedbackManager.show()
       └─> Reader.loadChapter(nextChapter)
```

## Extension Points

1. **New Effect Types**: Add cases to `engine.js` applyEffects()
2. **New Conditions**: Extend `conditions.js` evaluate()
3. **New UI Components**: Create in `engine/ui/` and register with UIManager
4. **New Themes**: Add CSS files in `style/` and register in ThemeManager
5. **New Languages**: Add JSON files in `language/` and update index.json
6. **Custom Book Features**: Use book.json manifest and book-specific CSS
