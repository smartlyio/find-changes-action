# Find directories that contain changes

Find directories that contain changes in the current pull request.

Based on inputs, will either:

- list all directories containing changes that match the specified
  nesting level (e.g. `1` for top-level directories, `2` for two-level
  nested directories, etc)
- List all directories containing changes that also contain a named
  file.

## Examples

### Directories at a certain level

```
- uses: smartlyio/find-changes-action
  with:
    directory_levels: 1
    exclude: "^(\.github($|\/.*))|(EXCLUDE_.*)"
```

### Directories containing a file

```
- uses: smartlyio/find-changes-action
  with:
    directory_containing: "config.yml"
    # use the default exclude only omitting .github and subdirectories
```
