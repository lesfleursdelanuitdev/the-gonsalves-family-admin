// Re-export the store provider and hook from @ligneous/story-creator so that
// admin components that call useStoryEditorStore() (e.g. StoryFlowNodeViews)
// share the same store instance provided by the package's StoryCreatorClient.
export { StoryEditorStoreProvider, useStoryEditorStore } from "@ligneous/story-creator/editor";
