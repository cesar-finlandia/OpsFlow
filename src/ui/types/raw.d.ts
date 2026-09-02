// Vite's `?raw` suffix returns a module whose default export is the file's text.
// The console uses it once, for the product story rendered by StoryDialog, so
// the page and design_documents/real-life-usecase-opsflow.md cannot drift apart.
declare module "*.md?raw" {
  const content: string;
  export default content;
}
