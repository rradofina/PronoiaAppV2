/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Remove the conflicting React module declaration since @types/react is now installed
// The real React types will be used instead.

declare module 'file-saver' {
  export function saveAs(data: Blob, filename: string): void;
}

declare module 'zustand' {
  type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void;
  type GetState<T> = () => T;
  type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;
  
  export function create<T>(): (createState: StateCreator<T>) => () => T;
  export function create<T>(createState: StateCreator<T>): () => T;
}

declare module 'zustand/middleware' {
  type StateCreator<T> = (set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void, get: () => T) => T;
  
  interface PersistOptions<T> {
    name: string;
    partialize?: (state: T) => any;
    getStorage?: () => any;
  }
  
  export function devtools<T>(fn: StateCreator<T>): StateCreator<T>;
  export function persist<T>(fn: StateCreator<T>, options?: PersistOptions<T>): StateCreator<T>;
} 