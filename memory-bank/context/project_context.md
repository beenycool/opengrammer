# OpenGrammar Project Context

## Project Overview
OpenGrammar is an advanced grammar checking application built with Electron that provides real-time grammar analysis, suggestions, and corrections.

## Core Components
- **Grammar Engine**: Core grammar analysis and correction logic
- **NLP Processor**: Natural language processing capabilities
- **Dictionary Store**: Word definitions and linguistic data management
- **Synonym Provider**: Contextual synonym suggestions
- **Overlay Service**: UI overlay for grammar suggestions
- **Settings Service**: Configuration management
- **Synapse Connector**: External service integration

## Current Architecture
- **Frontend**: Electron with TypeScript
- **Backend Services**: Node.js modules
- **Data Storage**: Local file-based storage
- **Testing**: Jest with comprehensive test suites

## Recent Iterations (LS2-LS10)
- LS2-LS4: Core grammar engine implementation
- LS5: Performance optimizations and NLP enhancements
- LS7: Overlay service and UI improvements
- LS8: Settings and Synapse integration
- LS9: Synonym provider and context analysis
- LS10: Comprehensive grammar engine enhancements

## Technical Debt
- Need centralized document context storage
- Multi-session analysis capabilities required
- Caching strategy needs implementation
- Service integration points need optimization

## Performance Metrics
- Test coverage: 85%+
- Performance benchmarks maintained
- Memory usage optimized through recent iterations