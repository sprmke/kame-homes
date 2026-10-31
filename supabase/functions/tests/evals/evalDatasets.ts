/** Loads a JSONL golden dataset from tests/evals/datasets. */
export async function readJsonl<T>(name: string): Promise<T[]> {
  const text = await Deno.readTextFile(new URL(`./datasets/${name}`, import.meta.url));
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
