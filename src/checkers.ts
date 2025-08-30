import { Err, Ok, type Result } from "@travbern/result-util";

export type Checker = (value: unknown) => Result<undefined, string>; // Returns an error if validation fails, otherwise undefined

type GetCheckerParams = {
    field: string;
    typeAnnotation: string;
};

export class UnknownPropertyError extends Error {}

// TODO: support for nested objects
// TODO: support for arrays
// TODO: support for reusing other types
// TODO: support for unions and intersections

export function getTypeChecker({
    field,
    typeAnnotation,
}: GetCheckerParams): Result<Checker, UnknownPropertyError> {
    const checker = knownTypes.get(typeAnnotation);
    if (checker) {
        return Ok(checker(field));
    }
    return Err(
        new UnknownPropertyError(
            `No checker available for field ${field} with type annotation: ${typeAnnotation}`,
        ),
    );
}

const knownTypes = new Map<string, (field: string) => Checker>([
    [
        "TSBooleanKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "boolean"
                ? Ok()
                : Err(`Expected boolean for ${field}, got ${typeof value}`),
    ],
    [
        "TSStringKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "string"
                ? Ok()
                : Err(`Expected string for ${field}, got ${typeof value}`),
    ],
    [
        "TSNumberKeyword",
        (field: string) => (value: unknown) =>
            typeof value === "number"
                ? Ok()
                : Err(`Expected number for ${field}, got ${typeof value}`),
    ],
]);
