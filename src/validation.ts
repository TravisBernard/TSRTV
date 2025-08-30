import { Err, Ok, type Result, unwrapErrSilently } from "@travbern/result-util";
import type { Validation } from "./parse";

export type Validator = (data: unknown) => Result<undefined, string[]>;

export class ValidationError extends Error {}

export function createValidator(validations: Validation[]): Validator {
    return (data: unknown) => {
        if (!validations.length) {
            return Ok(); // Nothing to validate
        }

        const errors = validations.reduce<string[]>((acc, validation) => {
            const err = unwrapErrSilently<string>(
                validateOne(data as Record<string, unknown>, validation),
            );
            if (err) {
                acc.push(err);
            }
            return acc;
        }, []);

        return errors.length ? Err(errors) : Ok();
    };
}

function validateOne(
    data: Record<string, unknown>,
    validation: Validation,
): Result<undefined, string> {
    const { field, optional, checkFn } = validation;
    if (!(field in data)) {
        if (optional) {
            return Ok();
        } else {
            return Err(`Missing required field: ${field}`);
        }
    }
    return checkFn(data[field]);
}
