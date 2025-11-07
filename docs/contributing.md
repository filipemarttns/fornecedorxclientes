# Contributing Guide

## Code Style

### JavaScript Style Guide

Follow these conventions for consistency:

**Indentation**:
- Use 4 spaces (no tabs)
- Consistent indentation throughout

**Naming Conventions**:
- Variables and functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `lowercase-with-hyphens.js` or `camelCase.js`

**Function Declarations**:
```javascript
// Preferred: Function declarations for top-level functions
function processMessage(message) {
  // ...
}

// Arrow functions for callbacks and inline functions
const filtered = items.filter(item => item.active);
```

**Variable Declarations**:
```javascript
// Use const by default
const message = await getMessage();

// Use let only when reassignment is needed
let counter = 0;
counter++;

// Avoid var
```

**Comments**:
```javascript
// Single-line comments for brief explanations
// Use clear, concise language

/**
 * Multi-line comments for complex logic
 * Explain the "why", not the "what"
 */
```

**Error Handling**:
```javascript
// Always handle errors explicitly
try {
  await riskyOperation();
} catch (error) {
  logger.error({ error: error.message }, 'Operation failed');
  // Handle or rethrow as appropriate
}
```

### Code Organization

**File Structure**:
1. Imports (external libraries)
2. Imports (local modules)
3. Configuration
4. Helper functions
5. Main logic
6. Event handlers
7. Initialization

**Function Order**:
1. Utility functions (pure functions)
2. Helper functions
3. Main processing functions
4. Event handlers
5. Initialization code

### Best Practices

- **Keep functions focused**: Single responsibility principle
- **Avoid deep nesting**: Use early returns and guard clauses
- **Use descriptive names**: Code should be self-documenting
- **Handle errors gracefully**: Don't let errors crash the bot
- **Log appropriately**: Use appropriate log levels
- **Comment complex logic**: Explain non-obvious decisions

## Branch Strategy

### Branch Naming

- **Feature branches**: `feature/description` (e.g., `feature/multiple-targets`)
- **Bug fixes**: `fix/description` (e.g., `fix/price-parsing`)
- **Documentation**: `docs/description` (e.g., `docs/api-documentation`)
- **Refactoring**: `refactor/description` (e.g., `refactor/message-processing`)

### Workflow

1. **Create branch from main**:
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature
```

2. **Make changes and commit**:
```bash
git add .
git commit -m "feat: add feature description"
```

3. **Push and create pull request**:
```bash
git push origin feature/your-feature
```

4. **After review and approval**, merge to main

### Main Branch Protection

- Main branch is protected
- All changes via pull requests
- Requires code review
- Requires passing tests (when implemented)

## Commit Conventions

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Test additions or changes
- **chore**: Maintenance tasks

### Examples

```
feat(price): add support for multiple price formats

Add regex pattern to detect prices in various formats:
- R$ 90,00
- $90,00
- 90,00

Closes #123
```

```
fix(message): prevent duplicate message forwarding

Fix deduplication logic to correctly identify duplicate
messages within the time window.

Fixes #456
```

```
docs(api): add API documentation

Document internal interfaces and message processing
pipeline for future API development.
```

### Commit Guidelines

- Use imperative mood ("add" not "added")
- Keep subject line under 50 characters
- Use body to explain "what" and "why"
- Reference issues in footer
- One logical change per commit

## How to Add New Features

### 1. Planning

- **Understand requirements**: Clearly define what the feature should do
- **Design approach**: Plan the implementation approach
- **Consider edge cases**: Think about error scenarios
- **Check dependencies**: Verify if new dependencies are needed

### 2. Implementation

**Create feature branch**:
```bash
git checkout -b feature/your-feature
```

**Write code**:
- Follow code style guidelines
- Add appropriate error handling
- Include logging for debugging
- Write clear, self-documenting code

**Test manually**:
- Test happy path
- Test error scenarios
- Test edge cases
- Verify logging output

**Update documentation**:
- Update relevant documentation files
- Add examples if applicable
- Update README if user-facing

### 3. Testing

**Manual Testing**:
- Test with real WhatsApp messages
- Verify price transformations
- Test media handling
- Verify error handling

**Test Files**:
- Add test cases to appropriate test file
- Run existing tests to ensure no regressions
- Add new test files if needed

### 4. Code Review

**Before submitting**:
- Review your own code
- Check for typos and formatting
- Verify all changes are committed
- Ensure documentation is updated

**Pull Request**:
- Clear title and description
- Reference related issues
- Include testing instructions
- Request review from maintainers

### 5. Integration

**After approval**:
- Merge to main branch
- Verify deployment (if applicable)
- Monitor for issues
- Update changelog if needed

## Feature Development Examples

### Adding a New Price Format

1. **Update regex pattern** in `src/index.js`:
```javascript
const priceRegex = /...existing pattern...|new-pattern/gi;
```

2. **Add test case** in `test_price_formats.js`:
```javascript
const testCases = [
  // ...existing cases...
  "New format: $99.99"
];
```

3. **Test manually**:
```bash
node test_price_formats.js
```

4. **Update documentation** in `docs/modules.md`:
- Document new format in price detection section

5. **Commit**:
```bash
git commit -m "feat(price): add support for new price format"
```

### Adding a New Filter

1. **Add filter logic** in message handler:
```javascript
// Add new filter
if (messageBodyLower.includes('blocked-keyword')) {
  logger.info(`[FILTRO] Mensagem ignorada: "${message.body.substring(0, 50)}..."`);
  return;
}
```

2. **Add configuration** (if needed):
```javascript
const BLOCKED_KEYWORDS = (process.env.BLOCKED_KEYWORDS || "")
  .split(',')
  .map(k => k.trim().toLowerCase())
  .filter(k => k);
```

3. **Update documentation**:
- Document new filter in `docs/modules.md`
- Update environment variables in `docs/installation.md`

4. **Test**:
- Test with messages containing blocked keywords
- Verify messages are filtered correctly

5. **Commit**:
```bash
git commit -m "feat(filter): add keyword filtering for blocked messages"
```

## Code Review Guidelines

### For Authors

- **Be responsive**: Address review comments promptly
- **Be open to feedback**: Accept constructive criticism
- **Explain decisions**: Provide context for non-obvious choices
- **Keep PRs focused**: One logical change per PR

### For Reviewers

- **Be constructive**: Provide helpful, specific feedback
- **Be timely**: Review within 24-48 hours
- **Ask questions**: Clarify unclear implementations
- **Approve when ready**: Don't block on minor issues

### Review Checklist

- [ ] Code follows style guidelines
- [ ] Functions are well-named and focused
- [ ] Error handling is appropriate
- [ ] Logging is adequate
- [ ] Documentation is updated
- [ ] Tests are added/updated
- [ ] No hardcoded values
- [ ] No security issues
- [ ] Performance considerations addressed

## Documentation Standards

### Code Comments

- Explain "why", not "what"
- Use clear, concise language
- Update comments when code changes
- Remove obsolete comments

### Documentation Files

- Keep documentation up to date
- Use clear, professional language
- Include examples where helpful
- Follow markdown conventions

### README Updates

- Update README for user-facing changes
- Keep installation instructions current
- Update feature list as needed
- Maintain accuracy of examples

## Testing Guidelines

### Test Coverage

- Test happy paths
- Test error scenarios
- Test edge cases
- Test configuration variations

### Test Files

- Keep test files organized
- Use descriptive test names
- Include setup and teardown if needed
- Document test scenarios

### Manual Testing

- Test with real WhatsApp messages
- Verify all message types (text, media, etc.)
- Test with various price formats
- Verify error handling

## Dependencies

### Adding Dependencies

- **Justify necessity**: Explain why dependency is needed
- **Check license**: Ensure compatible license
- **Check maintenance**: Verify package is actively maintained
- **Update package.json**: Add to appropriate section (dependencies/devDependencies)

### Updating Dependencies

- **Regular updates**: Keep dependencies up to date
- **Security updates**: Apply security patches promptly
- **Test after updates**: Verify functionality after updates
- **Document breaking changes**: Note any breaking changes

## Reporting Issues

### Bug Reports

Include:
- **Description**: Clear description of the issue
- **Steps to reproduce**: Detailed reproduction steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Node.js version, OS, etc.
- **Logs**: Relevant log excerpts
- **Screenshots**: If applicable

### Feature Requests

Include:
- **Description**: Clear description of the feature
- **Use case**: Why this feature is needed
- **Proposed solution**: How you think it should work
- **Alternatives**: Other approaches considered

## Getting Help

- **Check documentation**: Review relevant docs first
- **Search issues**: Check if issue already reported
- **Ask questions**: Open an issue for questions
- **Be patient**: Maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).

## Thank You

Thank you for contributing to the WhatsApp Message Forwarder project! Your contributions help make this tool better for everyone.

