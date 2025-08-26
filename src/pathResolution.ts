import fs from "node:fs";

const TS_EXTENSIONS = [".ts", ".d.ts", ".tsx", ".cts", ".mts"];

export function locateTypeScriptFile(path: string | undefined): string | null {
    const expandedPath = resolvePath(path);
    const [, _protocol, usePath] = expandedPath.match(/^(.*:\/\/)(.*?)$/) ?? [];
    const [, extensionless, ext] = usePath.match(/^(.*?)(\.[^.]+)?$/) ?? [];
    console.log(`File extension is ${ext ?? "none"}`);
    if (!TS_EXTENSIONS.includes(ext)) {
        console.info(
            `Extension ${ext} is not a TypeScript file, checking for alternatives...`,
        );
        // Look for a ts file in the same directory
        for (const extn of TS_EXTENSIONS) {
            const tsPath = `${extensionless}${extn}`;
            console.info(`Checking for TypeScript file at ${tsPath}`);
            if (fs.existsSync(tsPath)) {
                console.info(
                    `${extensionless} was not a TypeScript file so using ${tsPath} instead`,
                );
                return tsPath;
            }
        }
        return null;
    }

    if (!fs.existsSync(usePath)) {
        console.info(`File ${usePath} does not exist`);
        return null;
    }

    console.info(`File ${usePath} will be used`);
    return usePath;
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
