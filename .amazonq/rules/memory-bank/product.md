# Product Overview

## Project Purpose
Gaboma is a **gamebook engine** built with JavaScript, HTML, and CSS that enables authors to create interactive narrative experiences where player choices shape the story. It provides a complete framework for building choice-driven adventures with RPG elements like dice rolling, combat, inventory management, and character progression.

## Value Proposition
- **Author-Friendly**: Structured JSON-based story format allows writers to focus on narrative without complex programming
- **Feature-Rich**: Built-in support for variables, items, equipment, combat, dice mechanics, and conditional branching
- **Multilingual**: Full internationalization support for both UI and book content
- **Customizable**: Themes, fonts, and visual styles can be tailored per book or globally
- **Web-Based**: Runs entirely in the browser with no backend required, deployable via GitHub Pages

## Key Features

### Story Management
- Multiple book library with cover art and metadata
- Chapter-based narrative structure with branching paths
- Conditional content based on player state (variables, items, flags)
- Story history tracking with ability to review past choices
- Save/load game state with localStorage persistence

### Game Mechanics
- **Dice System**: Configurable dice rolls (count and sides) with visual animations
- **Combat Engine**: Turn-based combat with enemies, health tracking, and combat-specific actions
- **Variables**: Numeric and boolean variables with min/max constraints and fatal conditions
- **Inventory**: Item management with categories (consumable, equippable, key items)
- **Equipment System**: Slot-based equipment with onEquip/onUnequip hooks
- **Effects System**: Rich effect types (addVar, setVarMax, addItem, equipItem, consumeItem, etc.)

### User Interface
- **Library View**: Browse available books with covers and summaries
- **Book Home**: Dedicated landing page per book with cover flip animation
- **Reader View**: Clean reading interface with choice buttons and feedback
- **Configuration Panel**: Theme selection, font customization, language switching
- **Debug Panel**: Development tools for testing and state inspection
- **Dialog System**: Modal dialogs for confirmations and important messages
- **Feedback Manager**: Visual feedback for dice rolls, item changes, and game events

### Internationalization
- Global UI translations (English, Portuguese)
- Per-book language support with fallback mechanisms
- Dynamic language switching without page reload
- Translation key system with parameter interpolation

### Customization
- **Themes**: Multiple visual themes (Gaboma, Parchment, Dark, etc.)
- **Fonts**: Google Fonts integration with per-book and global font settings
- **Styling**: CSS-based styling with book-specific overrides
- **Manifest System**: Comprehensive book.json configuration for all aspects

## Target Users

### Primary: Gamebook Authors
Writers and game designers who want to create interactive fiction with RPG elements without deep programming knowledge. They can focus on storytelling while leveraging the engine's built-in mechanics.

### Secondary: Players
Readers who enjoy choice-driven narratives, interactive fiction, and gamebook experiences. The engine provides an engaging, modern interface for classic gamebook gameplay.

### Tertiary: Developers
JavaScript developers who want to extend the engine, add new features, or integrate it into larger projects. The modular architecture makes customization straightforward.

## Use Cases

1. **Interactive Fiction Creation**: Authors write branching narratives with meaningful choices
2. **Educational Games**: Create learning experiences with quiz-like mechanics and progression
3. **Adventure Games**: Build text-based adventures with inventory puzzles and exploration
4. **RPG Campaigns**: Digital gamebooks with character stats, combat, and equipment
5. **Prototyping**: Rapid prototyping of game narratives before full development
6. **Web Publishing**: Deploy interactive stories online via GitHub Pages or any web host
