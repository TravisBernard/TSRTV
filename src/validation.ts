import fs from "node:fs";
import {
    Err,
    Ok,
    type Result,
    unwrapErrSilently,
    unwrapOk,
} from "@travbern/result-util";
import {
    type Program,
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
    let tsPath: string;
    let ast: Program;
    let validations: Validation[];

    try {
        tsPath = unwrapOk(locateTypeScriptFile(path));
    } catch (e) {
        return Err(
            new GenerationError(
                `Error resolving ${path} to a typescript file: ${String(e)}`,
            ),
        );
    }

    try {
        ast = unwrapOk(parseFile(tsPath));
    } catch (e) {
        return Err(
            new GenerationError(
                `Error parsing TypeScript file ${tsPath}: ${String(e)}`,
            ),
        );
    }

    try {
        validations = unwrapOk(createValidationsList(ast, type));
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

function createValidator(validations: Validation[]): Validator {
    return (data: unknown) => {
        if (!validations.length) {
            return Ok(); // Nothing to validate
        }

        const errors = validations.reduce<ValidationError[]>(
            (acc, validation) => {
                const err = unwrapErrSilently<ValidationError>(
                    validateOne(data as Record<string, unknown>, validation),
                );
                if (err) {
                    acc.push(err);
                }
                return acc;
            },
            [],
        );

        return errors.length ? Err(errors) : Ok();
    };
}

function validateOne(
    data: Record<string, unknown>,
    validation: Validation,
): Result<undefined, ValidationError> {
    const { field, optional, checkFn } = validation;
    if (!(field in data)) {
        if (optional) {
            return Ok();
        } else {
            return Err(new ValidationError(`Missing required field: ${field}`));
        }
    }
    return checkFn(data[field]);
}

function createValidationsList(ast: Program, target: string) {
    const validations: Validation[] = [];

    let foundType: TSInterfaceDeclaration | TSTypeAliasDeclaration | null =
        null;
    try {
        walk(ast, {
            enter(node) {
                // Look for the target node
                if (
                    !foundType &&
                    (node.type === "TSInterfaceDeclaration" ||
                        node.type === "TSTypeAliasDeclaration") &&
                    node.id.name === target
                ) {
                    foundType = node;
                    return;
                }
                // Look for properties within the target node
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
                                throw new Error(
                                    `Unrecognized type annotation for field ${field}`,
                                );
                            }
                            const validation: Partial<Validation> = {
                                field,
                                optional,
                                checkFn: unwrapOk(
                                    getTypeChecker({
                                        field: field,
                                        typeAnnotation,
                                    }),
                                ),
                            };

                            validations.push(validation as Validation);
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
        return Ok(validations);
    } catch (e) {
        return Err(
            new GenerationError(
                `Error walking AST for type ${target}: ${String(e)}`,
            ),
        );
    }
}

function parseFile(filePath: string): Result<Program, GenerationError> {
    let tsCodeBuf: string;
    try {
        tsCodeBuf = fs.readFileSync(filePath, "utf-8");
        if (tsCodeBuf.length === 0) {
            throw new Error(`File is empty`); // this will get immediately caught
        }
    } catch (e) {
        return Err(
            new GenerationError(`Error reading file ${filePath}: ${String(e)}`),
        );
    }

    const { program: ast } = parseSync(filePath, tsCodeBuf);

    if (!ast) {
        return Err(
            new GenerationError(`Could not parse TypeScript file ${filePath}`),
        );
    }

    return Ok(ast);
}
