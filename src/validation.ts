import { Err, Ok, type Result, unwrapErrSilently } from "@travbern/result-util";
import type { Validation } from "./parse";

// TODO: support for nested objects
// TODO: support for arrays
// TODO: support for reusing other types
// TODO: support for unions and intersections

export type Validator = (data: unknown) => Result<undefined, string[]>;

export class ValidationError extends Error {}

export function createValidator(validations: Validation[]): Validator {
    return (data: unknown) => {
        if (!validations.length) {
            return Ok(); // Nothing to validate
        }

        const errors = validations.reduce<string[]>((acc, validation) => {
            const errs = unwrapErrSilently<string[]>(
                validateOne(data as Record<string, unknown>, validation),
            );
            if (errs) {
                acc.push(...errs);
            }
            return acc;
        }, []);

        return errors.length ? Err(errors) : Ok();
    };
}

function validateOne(
    data: Record<string, unknown>,
    validation: Validation,
): Result<undefined, string[]> {
    const { field, flat = false, optional, typeValidator } = validation;
    if (!flat && !(field in data)) {
        if (optional) {
            return Ok();
        } else {
            return Err([`Missing required field: ${field}`]);
        }
    }
    return typeValidator(flat ? data : data[field]);
}
