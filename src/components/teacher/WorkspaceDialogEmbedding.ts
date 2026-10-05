import { createContext } from 'react';
export const WorkspaceDialogEmbedding = createContext<null | { registerClose: (close: () => void) => () => void }>(null);
