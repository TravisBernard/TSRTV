import fs from "node:fs";
import { Err, Ok, type Result, unwrapOk } from "@travbern/result-util";

const TS_EXTENSIONS = [".ts", ".d.ts", ".tsx", ".cts", ".mts"];

export class ImportError extends Error {}

export interface ImportTSFileOk {
    code: string;
    resolvedPath: string;
}

export function importTSFile(
    path: string | undefined,
): Result<ImportTSFileOk, ImportError> {
    let resolvedPath: string;
    let code: string;

    try {
        resolvedPath = unwrapOk(locateTypeScriptFile(path));
    } catch (e) {
        return Err(
            new ImportError(
                `Error resolving ${path} to a typescript file: ${String(e)}`,
            ),
        );
    }
    try {
        code = fs.readFileSync(resolvedPath, "utf-8");
        if (code.length === 0) {
            throw new Error(`File is empty`); // this will get immediately caught
        }
    } catch (e) {
        return Err(
            new ImportError(`Error reading file ${resolvedPath}: ${String(e)}`),
        );
    }

    return Ok({ code, resolvedPath });
}

function locateTypeScriptFile(
    path: string | undefined,
): Result<string, undefined> {
    const expandedPath = resolveRelative(path);
    const [, _protocol, usePath] = expandedPath.match(/^(.*:\/\/)(.*?)$/) ?? [];
    const [, extensionless, ext] = usePath.match(/^(.*?)(\.[^.]+)?$/) ?? [];
    if (!TS_EXTENSIONS.includes(ext)) {
        // Look for a ts file in the same directory
        for (const extn of TS_EXTENSIONS) {
            const tsPath = `${extensionless}${extn}`;
            if (fs.existsSync(tsPath)) {
                return Ok(tsPath);
            }
        }
        return Err();
    }

    if (!fs.existsSync(usePath)) {
        return Err();
    }

    return Ok(usePath);
}

function resolveRelative(path: string | undefined) {
    // @ts-ignore -- TS1343: import.meta is not available when building for CJS
    if (import.meta?.resolve) {
        // @ts-ignore -- TS1343: import.meta is not available when building for CJS
        path = path ? import.meta.resolve(path) : import.meta.url;
    } else {
        path = path ? require.resolve(path) : __filename;
    }
    return path;
}
