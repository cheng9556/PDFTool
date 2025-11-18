import { normalize, resolve, sep } from 'node:path';

/**
 * Normalizes a given path by ensuring it ends with the appropriate path separator.
 * 
 * @param path - The path to be normalized.
 * @returns The normalized path.
 * @throws Error if the path is empty.
 */
export function normalizePath(path: string): string {
    if (path === '') {
        throw new Error('Path cannot be empty');
    }
    const resolvedPath: string = normalize(resolve(path));
    const trailing = sep; // platform-specific separator

    if (resolvedPath.endsWith(trailing)) {
        return resolvedPath;
    }

    return `${resolvedPath}${trailing}`;
}

/**
 * Normalizes a path for URL-like usage expected by pdf.js factories.
 * Always uses forward slashes and ensures a trailing '/'.
 */
export function normalizePathUrl(path: string): string {
    if (path === '') {
        throw new Error('Path cannot be empty');
    }
    const resolvedPath: string = normalize(resolve(path));
    const forward = resolvedPath.replace(/\\/g, '/');
    return forward.endsWith('/') ? forward : `${forward}/`;
}
