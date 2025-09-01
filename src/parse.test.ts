import { strict as assert } from "node:assert";
import { suite, test } from "node:test";
import { assertErr, assertOk, unwrapOk } from "@travbern/result-util";
import { parseCode, type Validation } from "./parse";

suite("Types", () => {
    suite("Primitive Aliases", () => {
        test("simple string alias", () => {
            const code = `type foo = string;`;
            const validations = unwrapOk<Validation[]>(
                parseCode("test.ts", code, "foo"),
            );
            assert.equal(validations.length, 1);
            assert.deepEqual(validations[0], {
                field: "foo",
                flat: true,
                optional: false,
                typeValidator: validations[0].typeValidator, // Can't compare functions directly
            });
            const { typeValidator } = validations[0];
            assertOk(typeValidator("John"));
            assertErr(typeValidator(123));
        });
        test("simple number alias", () => {
            const code = `type foo = number;`;
            const validations = unwrapOk<Validation[]>(
                parseCode("test.ts", code, "foo"),
            );
            assert.equal(validations.length, 1);
            assert.deepEqual(validations[0], {
                field: "foo",
                flat: true,
                optional: false,
                typeValidator: validations[0].typeValidator, // Can't compare functions directly
            });
            const { typeValidator } = validations[0];
            assertOk(typeValidator(123));
            assertErr(typeValidator("John"));
        });
        test("simple boolean alias", () => {
            const code = `type foo = boolean;`;
            const validations = unwrapOk<Validation[]>(
                parseCode("test.ts", code, "foo"),
            );
            assert.equal(validations.length, 1);
            assert.deepEqual(validations[0], {
                field: "foo",
                flat: true,
                optional: false,
                typeValidator: validations[0].typeValidator, // Can't compare functions directly
            });
            const { typeValidator } = validations[0];
            assertOk(typeValidator(true));
            assertOk(typeValidator(false));
            assertErr(typeValidator("John"));
        });
    });
});
