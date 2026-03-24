# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Core data layer implementation
  - Campaign management (CRUD operations)
  - Contact management with bulk import
  - Campaign-contact assignments
  - Spintax template parser for email personalization
  - Comprehensive validation utilities
  - Integration test suite (23 tests)
- Developer experience improvements
  - Prettier code formatting
  - Enhanced README with setup instructions
  - Contributing guidelines
  - Development guide
  - VSCode settings and extensions
  - Centralized error handling
  - Type-safe environment variables
  - Shared TypeScript types
- DRY principle refactoring
  - `verifyOrgOwnership()` helper (eliminated 15+ duplicates)
  - `cascadeDeleteAssignments()` helper (eliminated 4 duplicates)
  - Centralized validators and constants

### Changed

- Improved `.gitignore` with comprehensive patterns
- Enhanced npm scripts for development workflow

### Fixed

- N/A

## [0.1.0] - 2024-01-XX

### Added

- Initial project setup
- Next.js 16 with App Router
- Convex backend integration
- Better Auth with organization support
- Tailwind CSS styling
- Basic project structure

[Unreleased]: https://github.com/yourusername/project/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/project/releases/tag/v0.1.0
