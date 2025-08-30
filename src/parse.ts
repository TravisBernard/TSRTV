import { Err, Ok, type Result, unwrapOk } from "@travbern/result-util";
import type {
    TSInterfaceDeclaration,
    TSTypeAliasDeclaration,
} from "oxc-parser";
import { type Program, parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import { type Checker, getTypeChecker } from "./checkers";

export class ParseError extends Error {}

export type Validation = {
    field: string;
    optional: boolean;
    checkFn: Checker;
};

export function parseCode(
    fileName: string,
    code: string,
    target: string,
): Result<Validation[], ParseError> {
    const { program: ast } = parseSync(fileName, code);

    if (!ast) {
        return Err(
            new ParseError(`Could not parse TypeScript file ${fileName}`),
        );
    }

    return createValidationsList(ast, target);
}

function createValidationsList(
    ast: AST,
    target: string,
): Result<Validation[], ParseError> {
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
                        const optional = node.optional ?? false;
                        const field =
                            node.key.type === "Identifier"
                                ? node.key.name
                                : undefined;
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
            new ParseError(
                `Error walking AST for type ${target}: ${String(e)}`,
            ),
        );
    }
}

type AST = Program;
