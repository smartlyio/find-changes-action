# Find directories that contain changes

Find directories that contain changes on `pull_request` or `push` event.

Based on inputs, will either:

- list all directories containing changes that match the specified
  nesting level (e.g. `1` for top-level directories, `2` for second-level
  nested directories, etc)
- List all directories containing changes that also contain a named
  file.

## Examples

### Directories at a certain level

```yml
- uses: smartlyio/find-changes-action@v2
  with:
    directory_levels: 1
    exclude: '^(\.github($|\/.*))|(EXCLUDE_.*)'
```

### Directories containing a file

```yml
- uses: smartlyio/find-changes-action@v2
  with:
    directory_containing: 'config.yml'
    # use the default exclude only omitting .github and subdirectories
```
