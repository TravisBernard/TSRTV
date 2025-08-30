import fs from "node:fs";
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

export function parseFile(
    filePath: string,
    target: string,
): Result<Validation[], ParseError> {
    const ast = unwrapOk<AST>(fileToAST(filePath));
    return createValidationsList(ast, target);
}

function fileToAST(filePath: string): Result<Program, ParseError> {
    let tsCodeBuf: string;
    try {
        tsCodeBuf = fs.readFileSync(filePath, "utf-8");
        if (tsCodeBuf.length === 0) {
            throw new Error(`File is empty`); // this will get immediately caught
        }
    } catch (e) {
        return Err(
            new ParseError(`Error reading file ${filePath}: ${String(e)}`),
        );
    }

    const { program: ast } = parseSync(filePath, tsCodeBuf);

    if (!ast) {
        return Err(
            new ParseError(`Could not parse TypeScript file ${filePath}`),
        );
    }

    return Ok(ast);
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
            new ParseError(
                `Error walking AST for type ${target}: ${String(e)}`,
            ),
        );
    }
}

type AST = Program;
