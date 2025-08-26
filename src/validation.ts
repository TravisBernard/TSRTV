import fs from "node:fs";
import {
    Err,
    Ok,
    type Result,
    unwrapErrSilently,
    unwrapOkSilently,
} from "@travbern/result-util";
import {
    parseSync,
    type TSInterfaceDeclaration,
    type TSTypeAliasDeclaration,
} from "oxc-parser";
import { walk } from "oxc-walker";
import { getTypeChecker } from "./checkers";
import { locateTypeScriptFile } from "./pathResolution";

type Validator = (data: unknown) => Result<undefined, ValidationError[]>;

type Validation = {
    field: string;
    optional: boolean;
    checkFn: (data: unknown) => Result<undefined, ValidationError>; // Returns an error if validation fails, otherwise undefined
};

export class ValidationError extends Error {}

export class GenerationError extends Error {}

// TODO: support for scoping rules (export, block scope, etc)
// TODO: support for namespaces/modules
// TODO: type aliases that aren't objects `type foo = string`

export function createTypeValidator(
    type: string,
    path?: string,
): Result<Validator, GenerationError> {
    const startTime = Date.now();

    console.debug(`Locating the file`);
    let tsPath: string | null = null;
    // If the path is not a TS file or has no extension, look for the nearest TS file
    try {
        console.info(`Looking for file (${path})`);
        tsPath = locateTypeScriptFile(path);
        if (!tsPath) {
            return Err(
                new GenerationError(
                    `Could not find a TypeScript file for path: ${path}`,
                ),
            );
        }
    } catch (e) {
        return Err(
            new GenerationError(`Error resolving ${path}: ${String(e)}`),
        );
    }

    // TODO: Extract function to read and parse TS file
    console.debug("Reading TypeScript file");
    let tsCodeBuf: string;
    try {
        tsCodeBuf = fs.readFileSync(tsPath, "utf-8");
        if (tsCodeBuf.length === 0) {
            throw new Error(`File ${tsPath} is empty`);
        }
    } catch (e) {
        return Err(
            new GenerationError(
                `Error reading TypeScript file ${tsPath}: ${String(e)}`,
            ),
        );
    }

    console.debug(`Parsing TypeScript file`);
    const { program: ast } = parseSync(tsPath, tsCodeBuf);

    // TODO: Extract function to generate validations list from AST
    console.debug("Generating list of validations");

    const validations: Validation[] = [];

    let foundType: TSInterfaceDeclaration | TSTypeAliasDeclaration | null =
        null;
    walk(ast, {
        enter(node) {
            // Look for the base node
            if (
                !foundType &&
                (node.type === "TSInterfaceDeclaration" ||
                    node.type === "TSTypeAliasDeclaration") &&
                node.id.name === type
            ) {
                foundType = node;
                return;
            }
            // Look for properties within the base node
            if (foundType) {
                if (
                    node.type ===
                    "TSPropertySignature" /* || node.type === "TSMethodSignature" */
                ) {
                    const { name: field, optional = false } =
                        node.key.type === "Identifier" ? node.key : {};
                    if (field) {
                        const typeAnnotation =
                            node.typeAnnotation?.typeAnnotation?.type;
                        if (!typeAnnotation) {
                            console.error(
                                `Skipping property ${field} with no type annotation in ${node.type}`,
                            );
                            return;
                        }
                        const validation: Partial<Validation> = {
                            field,
                            optional,
                            checkFn: unwrapOkSilently(
                                getTypeChecker({
                                    field: field,
                                    typeAnnotation,
                                }),
                            ),
                        };

                        if (!validation.checkFn) {
                            console.error(
                                `No checker available for field ${field} with type annotation: ${typeAnnotation}`,
                            );
                            return;
                        }

                        console.debug(
                            `Adding validation for ${field} in ${node.type}`,
                        );
                        validations.push(validation as Validation);
                    } else {
                        console.warn(
                            `Skipping property with no name in ${node.type}`,
                        );
                    }
                }
            }
        },
        leave(node) {
            if (node === foundType) {
                foundType = null;
                return false;
            }
        },
    });

    console.log(`Found ${validations.length} validations for type ${type}`);

    // TODO: Extract function to create validator from validations list
    const validate: Validator = (data) => {
        if (!validations.length) {
            return Ok(); // Nothing to validate
        }
        const errors = validations
            .map((validation) => {
                const { field, optional, checkFn } = validation;
                const value = (data as Record<string, unknown>)[field];
                if (value === undefined) {
                    if (!optional) {
                        return new ValidationError(
                            `Missing required field: ${field}`,
                        );
                    }
                    return undefined; // Skip optional fields
                }
                return unwrapErrSilently(checkFn(value));
            })
            .filter((e) => !!e);

        if (!errors.length) {
            return Ok();
        }
        return Err(errors as ValidationError[]);
    };

    console.debug(`Validator generated in ${Date.now() - startTime}ms`);
    return Ok(validate);
}
