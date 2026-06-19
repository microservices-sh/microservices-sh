import { describe, expect, it } from "vitest";
import { createLibsqlDatabase } from "./libsql-graph";

describe("libsql graph database adapter", () => {
  it("passes sql + bound args to client.execute and maps rows on all()", async () => {
    const calls: any[] = [];
    const client = {
      async execute(stmt: any) {
        calls.push(stmt);
        return { rows: [{ node_id: "n1", label: "Margin report" }] };
      }
    };
    const db = createLibsqlDatabase(client);

    const result = await db.prepare("SELECT * FROM graph_nodes WHERE owner_id = ?").bind("o1").all();

    expect(result.results).toEqual([{ node_id: "n1", label: "Margin report" }]);
    expect(calls[0]).toEqual({ sql: "SELECT * FROM graph_nodes WHERE owner_id = ?", args: ["o1"] });
  });

  it("executes writes on run()", async () => {
    const calls: any[] = [];
    const client = { async execute(stmt: any) { calls.push(stmt); return { rows: [] }; } };
    await createLibsqlDatabase(client).prepare("INSERT INTO graph_nodes VALUES (?)").bind("x").run();
    expect(calls[0].args).toEqual(["x"]);
  });
});
