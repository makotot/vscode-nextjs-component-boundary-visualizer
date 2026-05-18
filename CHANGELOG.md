# vscode-nextjs-component-boundary-visualizer

## 0.9.1

### Patch Changes

- 02c472a: Shorten the Server in Client decoration label from `🌐 Server component composed in Client` to `🌐 Server in Client` to align with `⚡️ Client Boundary`. Also improves the hover message to better explain the RSC composition pattern.

## 0.9.0

### Minor Changes

- 4e2054b: Add end-of-line decoration (`🌐 Server component composed in Client`) for Server and Universal Components passed as props or children to a Client Component. This clarifies that these components execute on the server despite being visually nested inside a Client Component in JSX.

## 0.8.3

### Patch Changes

- 5ee7f01: Silently ignore initialization errors for non-Next.js projects. Errors are still shown when a `next.config.*` file is present.

## 0.8.2

### Patch Changes

- ebcb151: update component-env-graph to 0.1.11

## 0.8.1

### Patch Changes

- 291a344: Improve extension activation time.

## 0.8.0

### Minor Changes

- c139fc8: add an option to exclude files or directories from analysis.

### Patch Changes

- bb298ba: update component-env-graph to v0.1.10

## 0.7.0

### Minor Changes

- d819992: migrate extension to esm

## 0.6.0

### Minor Changes

- e9efc16: Adding an icon to the client boundary in JSX

## 0.5.1

### Patch Changes

- 6058a12: update snapshot

## 0.5.0

### Minor Changes

- 7818383: remove background color

### Patch Changes

- 4943406: fix

## 0.4.0

### Minor Changes

- e83374c: disable enableLineIcon by default
