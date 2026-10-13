import type { PanelClose } from '../../lib/studentDialogNavigation';
import { createContext } from 'react';
export const WorkspaceDialogEmbedding = createContext<null | { registerClose: (close: PanelClose) => () => void }>(null);
