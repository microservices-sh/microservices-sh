export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "src/index.ts",
    "MARKETING_NO_SIGNALS",
    "Marketing Research refuses to synthesize when no grounded signals exist."
  );
  assertFileIncludes(
    "src/index.ts",
    "MARKETING_UNCITED",
    "Marketing Research refuses uncited or hallucinated source output."
  );
  assertFileIncludes(
    "README.md",
    "cites every claim or refuses",
    "README documents cite-or-refuse behavior."
  );
}
