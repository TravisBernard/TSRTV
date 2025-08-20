import fs from "node:fs";
import { parseSync, type TSInterfaceDeclaration, type TSTypeAliasDeclaration } from "oxc-parser";
import { walk } from "oxc-walker";

const TS_EXTENSIONS = [".ts", ".d.ts", ".tsx", ".cts", ".mts"];

type SuccessResult = {
  ok: true;
};

type ErrorResult<E extends Error> = {
  ok: false;
  errors: E[];
};

type CreateTypeValidatorResultOk = SuccessResult & {
  validate: (data: unknown) => ValidateResult;
};

type CreateTypeValidatorResultError = ErrorResult<ValidationError>; // TODO: Use a different error type here

type CreateTypeValidatorResult = CreateTypeValidatorResultOk | CreateTypeValidatorResultError;

type Validation = {
  field: string;
  optional: boolean;
  checkFn: (value: unknown) => ValidationError | undefined; // Returns an error if validation fails, otherwise undefined
};

export type ValidateSuccess = SuccessResult;

export type ValidateError = ErrorResult<ValidationError>;

export type ValidateResult = ValidateSuccess | ValidateError;

export class ValidationError extends Error {}

export function createTypeValidator(type: string, path?: string): CreateTypeValidatorResult {
  const startTime = Date.now();
  console.debug(`Locating the file`);
  let tsPath: string | null = null;
  // If the path is not a TS file or has no extension, look for the nearest TS file
  try {
    path = path ? import.meta.resolve(path) : import.meta.url;
    console.info(`Looking for file (${path})`);
    tsPath = locateTypeScriptFile(path);
    if (!tsPath) {
      return {
        ok: false,
        errors: [new ValidationError(`Could not find a TypeScript file for path: ${path}`)],
      };
    }
  } catch (e) {
    return {
      ok: false,
      errors: [new ValidationError(`Error resolving ${path}: ${String(e)}`)],
    };
  }

  console.debug("Reading TypeScript file");
  let tsCodeBuf: string;
  try {
    tsCodeBuf = fs.readFileSync(tsPath, "utf-8");
    if (tsCodeBuf.length === 0) {
      throw new Error(`File ${tsPath} is empty`);
    }
  } catch (e) {
    return { ok: false, errors: [new ValidationError(`Error reading TypeScript file ${tsPath}: ${String(e)}`)] };
  }

  console.debug(`Parsing TypeScript file`);
  const { program: ast } = parseSync(tsPath, tsCodeBuf);

  console.debug("Generating list of validations");

  const validations: Validation[] = [];

  let foundType: TSInterfaceDeclaration | TSTypeAliasDeclaration | null = null;
  walk(ast, {
    enter(node) {
      // Look for the base node
      if (
        !foundType &&
        (node.type === "TSInterfaceDeclaration" || node.type === "TSTypeAliasDeclaration") &&
        node.id.name === type
      ) {
        foundType = node;
        return;
      }
      // Look for properties within the base node
      if (foundType) {
        if (node.type === "TSPropertySignature" /* || node.type === "TSMethodSignature" */) {
          const { name, optional = false } = node.key.type === "Identifier" ? node.key : {};
          if (name) {
            const validation: Partial<Validation> = {
              field: name,
              optional,
            };
            switch (node.typeAnnotation?.typeAnnotation?.type) {
              case "TSBooleanKeyword":
                validation.checkFn = (value: unknown) =>
                  typeof value !== "boolean"
                    ? new ValidationError(`Expected boolean for ${name}, got ${typeof value}`)
                    : undefined;
                break;
              case "TSStringKeyword":
                validation.checkFn = (value: unknown) =>
                  typeof value !== "string"
                    ? new ValidationError(`Expected string for ${name}, got ${typeof value}`)
                    : undefined;
                break;
              case "TSNumberKeyword":
                validation.checkFn = (value: unknown) =>
                  typeof value !== "number"
                    ? new ValidationError(`Expected number for ${name}, got ${typeof value}`)
                    : undefined;
                break;
              default:
                console.warn(`Skipping unsupported type annotation in ${node.type}`);
            }
            if (validation.checkFn) {
              console.debug(`Adding validation for ${name} in ${node.type}`);
              validations.push(validation as Validation);
            } else {
              console.warn(`Skipping property ${name} with no check function in ${node.type}`);
            }
          } else {
            console.warn(`Skipping property with no name in ${node.type}`);
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

  const validate = (data: unknown): ValidateResult => {
    if (!validations.length) {
      return { ok: true };
    }
    const errors = validations
      .map((validation) => {
        const { field, optional, checkFn } = validation;
        const value = (data as Record<string, unknown>)[field];
        if (value === undefined) {
          if (!optional) {
            return new ValidationError(`Missing required field: ${field}`);
          }
          return undefined; // Skip optional fields
        }
        return checkFn(value);
      })
      .filter((e) => !!e);

    if (!errors.length) {
      return { ok: true };
    }
    return {
      ok: false,
      errors,
    };
  };

  console.debug(`Validator generated in ${Date.now() - startTime}ms`);
  return { ok: true, validate };
}

// TODO: type aliases that aren't objects `type foo = string`
// TODO: support for nested objects
// TODO: support for arrays
// TODO: support for reusing other types
// TODO: support for namespaces/modules
// TODO: support for scoping rules (export, block scope, etc)
// TODO: support for unions and intersections

function locateTypeScriptFile(path: string): string | null {
  const [, _protocol, usePath] = path.match(/^(.*:\/\/)(.*?)$/) ?? [];
  const [, extensionless, ext] = usePath.match(/^(.*?)(\.[^.]+)?$/) ?? [];
  console.log(`File extension is ${ext ?? "none"}`);
  if (!TS_EXTENSIONS.includes(ext)) {
    console.info(`Extension ${ext} is not a TypeScript file, checking for alternatives...`);
    // Look for a ts file in the same directory
    for (const extn of TS_EXTENSIONS) {
      const tsPath = `${extensionless}${extn}`;
      console.info(`Checking for TypeScript file at ${tsPath}`);
      if (fs.existsSync(tsPath)) {
        console.info(`${extensionless} was not a TypeScript file so using ${tsPath} instead`);
        return tsPath;
      }
    }
    return null;
  }

  if (!fs.existsSync(usePath)) {
    console.info(`File ${usePath} does not exist`);
    return null;
  }

  console.info(`File ${usePath} will be used`);
  return usePath;
}

// validateType("DocumentType");
// console.info("---");
const validateResult = createTypeValidator("DocumentType", "./document.ts");
if (validateResult.ok) {
  console.info("Validation function created successfully");
  const { validate } = validateResult;
  console.log("Validating example data...", validate({ id: "abc", title: "foo", content: "Hello, world!" }));
  console.log("Validating invalid data...", validate({ id: 123, title: null, content: false }));
}
// console.info("---");
// validateType("DocumentType", "./document");
// console.info("---");
// validateType("DocumentType", "#document");
// console.info("---");
// validateType("DocumentType", "./document.js");
// console.info("---");
// validateType("DocumentType", "./foo.ts");
// console.info("---");
// validateType("DocumentType", "foo");
