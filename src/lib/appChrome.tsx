import {createContext,useContext} from 'react';

/** The app's top-bar controls (home, profile menu), handed to a screen that shows them in its own header instead of the
 *  app bar — the teacher room merges them into its navigation row to save vertical space. */
export type AppChromeControls={home:()=>void;openMenu:()=>void;name:string;photo?:string|null;alert?:boolean};
export const AppChrome=createContext<AppChromeControls|null>(null);
export const useAppChrome=()=>useContext(AppChrome);
