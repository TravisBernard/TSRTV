# TypeScript Runtime Validator

This is a very early, very early, very rough draft of a begining of a concept of a potential project

Do not use

## Purpose

To use the type definitions that exist in your code (in the .ts files if running TS directly or in .d.ts files if running build artifacts) and use them to generate type validators at runtime.

This is different from AoT compilers like Typia because it doesn't do any transpile-time work and so needs no special configuration or TS patching.

It's also different from TS-like validators such as ArkType and Zod because it doesn't supplant your native TypeScript types with a DSL, using instead the actual TS definitions in your code

## Limitations

There are probably many.  This is probably a bad idea.  One already known limitation is that you must output declaration files (but most people do) and those declaration files must be available to you runtime (which is easily done).

## Run it if you dare

```
npx tsx src/validation.ts
```