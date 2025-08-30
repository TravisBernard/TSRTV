import fs from "node:fs";
import { Err, Ok, type Result } from "@travbern/result-util";

const TS_EXTENSIONS = [".ts", ".d.ts", ".tsx", ".cts", ".mts"];

export function locateTypeScriptFile(
    path: string | undefined,
): Result<string, undefined> {
    const expandedPath = resolvePath(path);
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

function resolvePath(path: string | undefined) {
    // @ts-ignore -- TS1343: import.meta is not available when building for CJS
    if (import.meta?.resolve) {
        // @ts-ignore -- TS1343: import.meta is not available when building for CJS
        path = path ? import.meta.resolve(path) : import.meta.url;
    } else {
        path = path ? require.resolve(path) : __filename;
    }
    return path;
}
