import { Err, Ok, type Result } from "@travbern/result-util";
import { ValidationError, type Validator } from "../validation";

type GetCheckerParams = {
    field: string;
    typeAnnotation: string;
};

export function getPrimitiveValidator({
    field,
    typeAnnotation,
}: GetCheckerParams): Result<Validator, ValidationError> {
    const checker = primitiveTypeCheckers.get(typeAnnotation);
    if (checker) {
        return Ok(checker(field));
    }
    return Err(
        new ValidationError(
            `No checker available for field ${field} with type annotation: ${typeAnnotation}`,
        ),
    );
}

const primitiveTypeCheckers = new Map<string, (field: string) => Validator>([
    [
        "TSBooleanKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "boolean"
                ? Ok()
                : Err([`Expected boolean for ${field}, got ${typeof value}`]),
    ],
    [
        "TSStringKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "string"
                ? Ok()
                : Err([`Expected string for ${field}, got ${typeof value}`]),
    ],
    [
        "TSNumberKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "number"
                ? Ok()
                : Err([`Expected number for ${field}, got ${typeof value}`]),
    ],
]);
