import { Err, Ok, type Result, unwrapOk } from "@travbern/result-util";
import { type ImportTSFileOk, importTSFile } from "./file";
import { parseCode, type Validation } from "./parse";
import { createValidator, type Validator } from "./validation";

export class GenerationError extends Error {}
// TODO: support for scoping rules (export, block scope, etc)
// TODO: support for namespaces/modules
// TODO: type aliases that aren't objects `type foo = string`

export function createTypeValidator(
    type: string,
    path?: string,
): Result<Validator, GenerationError> {
    const startTime = Date.now();
    let resolvedPath: string;
    let code: string;
    let validations: Validation[];

    try {
        const imported = unwrapOk<ImportTSFileOk>(importTSFile(path));
        code = imported.code;
        resolvedPath = imported.resolvedPath;
    } catch (e) {
        return Err(
            new GenerationError(
                `Error resolving ${path} to a typescript file: ${String(e)}`,
            ),
        );
    }

    try {
        validations = unwrapOk(parseCode(resolvedPath, code, type));
    } catch (e) {
        return Err(
            new GenerationError(
                `Error generating validations for type ${type}: ${String(e)}`,
            ),
        );
    }

    const validator = createValidator(validations);

    // TODO: Cache the validator based on path+type
    console.debug(`Validator generated in ${Date.now() - startTime}ms`);
    return Ok(validator);
}
