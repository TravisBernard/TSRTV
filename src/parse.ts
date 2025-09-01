import { Err, Ok, type Result, unwrapOkSilently } from "@travbern/result-util";
import type {
    Node,
    TSInterfaceDeclaration,
    TSTypeAliasDeclaration,
} from "oxc-parser";
import { type Program, parseSync } from "oxc-parser";
import type { Validator } from "./validation";
import { getPrimitiveValidator } from "./validators/primitives";

export class ParseError extends Error {}

export type Validation = {
    field: string;
    flat?: boolean;
    optional: boolean;
    typeValidator: Validator;
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

type AST = Program;

function createValidationsList(
    ast: AST,
    target: string,
): Result<Validation[], ParseError> {
    const nonTargetTypes: Map<string, Node> = new Map();
    let targetNode: TSInterfaceDeclaration | TSTypeAliasDeclaration | null =
        null;

    try {
        for (const node of ast.body) {
            if (
                node.type === "TSInterfaceDeclaration" ||
                node.type === "TSTypeAliasDeclaration"
            ) {
                if (node.id.name === target) {
                    targetNode = node;
                } else {
                    nonTargetTypes.set(node.id.name, node);
                }
            }
        }

        if (!targetNode) {
            return Err(new ParseError(`Type ${target} not found in AST`));
        }

        return Ok(processTSDeclaration(targetNode, nonTargetTypes));
    } catch (e) {
        return Err(
            new ParseError(
                `Error walking AST for type ${target}: ${String(e)}`,
            ),
        );
    }
}

function processTSDeclaration(
    node: TSTypeAliasDeclaration | TSInterfaceDeclaration,
    nonTargetTypes: Map<string, Node>,
): Validation[] {
    switch (node.type) {
        case "TSTypeAliasDeclaration":
            return processTypeAliasDeclaration(node, nonTargetTypes);
        // case "TSInterfaceDeclaration":
        //     processInterfaceDeclaration(node, nonTargetTypes);
        //     break;
        default:
            throw new ParseError(`Unsupported node type: ${node.type}`);
    }
}

function processTypeAliasDeclaration(
    node: TSTypeAliasDeclaration,
    _nonTargetTypes: Map<string, Node>,
): Validation[] {
    const { id, typeAnnotation } = node;
    switch (typeAnnotation.type) {
        case "TSTypeLiteral":
            // TODO:
            return [];
        case "TSTypeReference":
            // TODO:
            return [];
        default: {
            const checker = unwrapOkSilently<Validator>(
                getPrimitiveValidator({
                    field: id.name,
                    typeAnnotation: typeAnnotation.type,
                }),
            );
            if (checker) {
                return [
                    {
                        field: id.name,
                        flat: true,
                        optional: false,
                        typeValidator: checker,
                    },
                ];
            } else {
                throw new ParseError(
                    `Unsupported or unknown type reference: ${typeAnnotation.type}`,
                );
            }
        }
    }
}
