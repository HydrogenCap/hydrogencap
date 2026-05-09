/**
 * Unit tests for the auto-compliance-pipeline logic. Run with:
 *
 *   deno test supabase/functions/auto-compliance-pipeline/pipeline.test.ts --allow-env
 *
 * Uses a fake supabase client that captures the fluent-builder calls, so we
 * can assert both the data flow AND the DB operations the pipeline performs.
 */
import {
  authorizeRequest,
  buildCorsHeaders,
  daysBetween,
  getPriority,
  runAutoCompliancePipeline,
  type RequestAuthorization,
  type SupabaseLike,
} from "./pipeline.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const equal = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (!equal) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function quietConsole() {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return () => { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; };
}

// ── Pure helpers ────────────────────────────────────────────────────

Deno.test("daysBetween — counts calendar days (floored)", () => {
  assertEquals(daysBetween("2025-06-15", "2025-06-16"), 1);
  assertEquals(daysBetween("2025-06-15", "2025-07-15"), 30);
  // Negative when b < a
  assertEquals(daysBetween("2025-06-15", "2025-06-14"), -1);
  // Same day = 0
  assertEquals(daysBetween("2025-06-15", "2025-06-15"), 0);
});

Deno.test("getPriority — critical <= 7, high <= 30, medium <= 60, low otherwise", () => {
  assertEquals(getPriority(-5), "critical");
  assertEquals(getPriority(0), "critical");
  assertEquals(getPriority(7), "critical");
  assertEquals(getPriority(8), "high");
  assertEquals(getPriority(30), "high");
  assertEquals(getPriority(31), "medium");
  assertEquals(getPriority(60), "medium");
  assertEquals(getPriority(61), "low");
  assertEquals(getPriority(9999), "low");
});

Deno.test("buildCorsHeaders — echoes an allowed origin", () => {
  const headers = buildCorsHeaders(
    new Request("https://f.test", { headers: { Origin: "https://tenureiq.com" } }),
    ["https://tenureiq.com", "https://other.com"],
  );
  assertEquals(headers["Access-Control-Allow-Origin"], "https://tenureiq.com");
});

Deno.test("buildCorsHeaders — falls back to the first allowed origin when request origin isn't allowed", () => {
  const headers = buildCorsHeaders(
    new Request("https://f.test", { headers: { Origin: "https://evil.example" } }),
    ["https://tenureiq.com", "https://other.com"],
  );
  assertEquals(headers["Access-Control-Allow-Origin"], "https://tenureiq.com");
});

Deno.test("buildCorsHeaders — declares the expected custom headers", () => {
  const headers = buildCorsHeaders(new Request("https://f.test"), ["https://tenureiq.com"]);
  assert(headers["Access-Control-Allow-Headers"].includes("authorization"));
  assert(headers["Access-Control-Allow-Headers"].includes("x-supabase-client-platform"));
});

// ── authorizeRequest ────────────────────────────────────────────────

function makeAuthSupabase(user: { id: string } | null, memberships: Array<{ org_id: string; role: string }> | { error: { message: string } }): SupabaseLike {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in() {
      if (!Array.isArray(memberships)) {
        return Promise.resolve({ data: null, error: memberships.error });
      }
      return Promise.resolve({ data: memberships, error: null });
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    from: () => builder,
    auth: {
      getUser: async () => ({
        data: { user },
        error: user ? null : { message: "invalid token" },
      }),
    },
  };
}

Deno.test("authorizeRequest — returns cron mode when Bearer matches CRON_SECRET", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer cron-secret-123" } });
  const sb = makeAuthSupabase(null, []);
  const auth = await authorizeRequest(req, sb, "cron-secret-123");
  assertEquals(auth.mode, "cron");
  assertEquals(auth.manageableOrgIds, null);
});

Deno.test("authorizeRequest — falls through to user auth when cron secret doesn't match", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer user-token" } });
  const sb = makeAuthSupabase({ id: "user-1" }, [{ org_id: "org-1", role: "owner" }]);
  const auth = await authorizeRequest(req, sb, "different-cron");
  assertEquals(auth.mode, "user");
  assertEquals(auth.manageableOrgIds?.length, 1);
  assertEquals(auth.manageableOrgIds?.[0], "org-1");
});

Deno.test("authorizeRequest — throws Unauthorized when no Authorization header", async () => {
  const req = new Request("https://f.test");
  try {
    await authorizeRequest(req, makeAuthSupabase(null, []));
    throw new Error("expected throw");
  } catch (err) {
    assertEquals((err as Error).message, "Unauthorized");
  }
});

Deno.test("authorizeRequest — throws Unauthorized when Authorization header doesn't start with Bearer", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Basic xyz" } });
  try {
    await authorizeRequest(req, makeAuthSupabase(null, []));
    throw new Error("expected throw");
  } catch (err) {
    assertEquals((err as Error).message, "Unauthorized");
  }
});

Deno.test("authorizeRequest — throws Unauthorized when supabase.auth.getUser returns null user", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer bad" } });
  try {
    await authorizeRequest(req, makeAuthSupabase(null, []));
    throw new Error("expected throw");
  } catch (err) {
    assertEquals((err as Error).message, "Unauthorized");
  }
});

Deno.test("authorizeRequest — throws Access denied when user has no owner/admin memberships", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer ok" } });
  try {
    await authorizeRequest(req, makeAuthSupabase({ id: "u1" }, []));
    throw new Error("expected throw");
  } catch (err) {
    assertEquals((err as Error).message, "Access denied");
  }
});

Deno.test("authorizeRequest — deduplicates manageable org ids", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer ok" } });
  const sb = makeAuthSupabase({ id: "u1" }, [
    { org_id: "org-1", role: "owner" },
    { org_id: "org-1", role: "admin" }, // duplicate org
    { org_id: "org-2", role: "admin" },
  ]);
  const auth = await authorizeRequest(req, sb);
  assertEquals(auth.mode, "user");
  assertEquals(auth.manageableOrgIds?.length, 2);
});

Deno.test("authorizeRequest — propagates membership fetch errors", async () => {
  const req = new Request("https://f.test", { headers: { Authorization: "Bearer ok" } });
  const sb = makeAuthSupabase({ id: "u1" }, { error: { message: "db down" } });
  try {
    await authorizeRequest(req, sb);
    throw new Error("expected throw");
  } catch (err) {
    assertEquals((err as { message: string }).message, "db down");
  }
});

// ── runAutoCompliancePipeline ───────────────────────────────────────

interface FakeCall {
  table: string;
  op: "select" | "insert" | "update";
  filters: Record<string, unknown>;
  payload?: unknown;
  terminal: "maybeSingle" | "single" | "await";
}

type PipelineHandler = (call: FakeCall) => { data?: unknown; error?: unknown };

function makePipelineSupabase(handler: PipelineHandler): { client: SupabaseLike; calls: FakeCall[] } {
  const calls: FakeCall[] = [];

  const client: SupabaseLike = {
    from(table: string) {
      let payload: unknown;
      const filters: Record<string, unknown> = {};
      const finish = (op: FakeCall["op"], terminal: FakeCall["terminal"]) => {
        const call: FakeCall = { table, op, filters: { ...filters }, payload, terminal };
        calls.push(call);
        return Promise.resolve(handler(call));
      };
      const builder = {
        select(cols?: string) { filters.__cols = cols; return builder; },
        eq(key: string, val: unknown) { filters[key] = val; return builder; },
        in(key: string, val: unknown) { filters[key] = val; return builder; },
        not(key: string, op: string, val: unknown) { filters[`__not_${key}`] = [op, val]; return builder; },
        lte(key: string, val: unknown) { filters[`__lte_${key}`] = val; return builder; },
        gte(key: string, val: unknown) { filters[`__gte_${key}`] = val; return builder; },
        order() { return builder; },
        limit() { return builder; },
        contains(key: string, val: unknown) { filters[`__contains_${key}`] = val; return builder; },
        maybeSingle() { return finish("select", "maybeSingle"); },
        single() { return finish("select", "single"); },
        then(resolve: (v: unknown) => unknown) { return finish("select", "await").then(resolve); },
      };
      return {
        ...builder,
        insert(p: unknown) {
          payload = p;
          const insertBuilder = {
            select() { return insertBuilder; },
            single() { return finish("insert", "single"); },
            then(resolve: (v: unknown) => unknown) { return finish("insert", "await").then(resolve); },
          };
          return insertBuilder;
        },
        update(p: unknown) {
          payload = p;
          const updateBuilder = {
            eq(key: string, val: unknown) { filters[key] = val; return updateBuilder; },
            then(resolve: (v: unknown) => unknown) { return finish("update", "await").then(resolve); },
          };
          return updateBuilder;
        },
      };
    },
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  };

  return { client, calls };
}

const cronAuth: RequestAuthorization = { mode: "cron", manageableOrgIds: null };
const userAuth: RequestAuthorization = { mode: "user", manageableOrgIds: ["org-1"] };

const NOW = new Date("2025-06-15T12:00:00Z");

Deno.test("pipeline — returns all-zero counts when there are no expiring docs", async () => {
  const restore = quietConsole();
  try {
    const { client } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: [], error: null };
      if (call.table === "compliance_documents_v2") return { data: [], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 0);
    assertEquals(result.contractors_assigned, 0);
    assertEquals(result.notifications_sent, 0);
    assertEquals(result.requests_sent, 0);
    assertEquals(result.priorities_updated, 0);
  } finally { restore(); }
});

Deno.test("pipeline — propagates errors from the templates query", async () => {
  const restore = quietConsole();
  try {
    const { client } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: null, error: { message: "tpl fail" } };
      return { data: null, error: null };
    });
    try {
      await runAutoCompliancePipeline(client, cronAuth, NOW);
      throw new Error("expected throw");
    } catch (err) {
      assertEquals((err as { message: string }).message, "tpl fail");
    }
  } finally { restore(); }
});

Deno.test("pipeline — scopes the docs query by org when authorization is user mode", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: [], error: null };
      if (call.table === "compliance_documents_v2") return { data: [], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    await runAutoCompliancePipeline(client, userAuth, NOW);
    const docsCall = calls.find((c) => c.table === "compliance_documents_v2");
    assert(docsCall);
    assertEquals(docsCall!.filters.org_id, ["org-1"]);
  } finally { restore(); }
});

Deno.test("pipeline — does NOT scope the docs query when authorization is cron mode", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: [], error: null };
      if (call.table === "compliance_documents_v2") return { data: [], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    await runAutoCompliancePipeline(client, cronAuth, NOW);
    const docsCall = calls.find((c) => c.table === "compliance_documents_v2");
    assert(docsCall);
    assertEquals(docsCall!.filters.org_id, undefined);
  } finally { restore(); }
});

Deno.test("pipeline — skips docs outside the renewal window (daysUntil > leadTime)", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "gas_safety", display_name: "Gas Safety", default_lead_time_days: 30, default_frequency_months: 12 }];
    // expiry is 60 days away — lead time is 30 → skip.
    const doc = {
      id: "d1", property_id: "p1", document_type: "gas_safety", expiry_date: "2025-08-14",
      org_id: "org-1", property: { address_line_1: "10 High St" },
    };
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 0);
    // No compliance_tasks insert
    assertEquals(calls.some((c) => c.table === "compliance_tasks" && c.op === "insert"), false);
  } finally { restore(); }
});

Deno.test("pipeline — creates task + notification for an in-window expiring doc without a contractor", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "gas_safety", display_name: "Gas Safety Certificate", default_lead_time_days: 30, default_frequency_months: 12 }];
    const doc = {
      id: "d1", property_id: "p1", document_type: "gas_safety", expiry_date: "2025-06-20",
      org_id: "org-1",
      property: { address_line_1: "10 High St", city: "Oxford", postcode: "OX1 1AA" },
    };
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: null, error: null }; // no existing task
      if (call.table === "compliance_contractors") return { data: null, error: null }; // no contractor
      if (call.table === "compliance_tasks" && call.op === "insert") return { data: { id: "task-1" }, error: null };
      if (call.table === "compliance_notifications") return { data: null, error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 1);
    assertEquals(result.contractors_assigned, 0);
    assertEquals(result.notifications_sent, 1);
    assertEquals(result.requests_sent, 0);

    // Inspect the task payload.
    const taskInsert = calls.find((c) => c.table === "compliance_tasks" && c.op === "insert")!;
    const taskPayload = taskInsert.payload as Record<string, unknown>;
    assertEquals(taskPayload.status, "pending");
    assertEquals(taskPayload.priority, "critical"); // 5 days until → critical
    assertEquals(taskPayload.contractor_id, null);
    assertEquals(taskPayload.task_type, "renewal_due");
    assertEquals(taskPayload.source, "auto_pipeline");
    // Description includes the property address.
    assert(String(taskPayload.description).includes("10 High St"));
    assert(String(taskPayload.description).includes("OX1 1AA"));

    // Notification payload says "expiring_soon" and references the task id.
    const notifInsert = calls.find((c) => c.table === "compliance_notifications" && c.op === "insert")!;
    const notifPayload = notifInsert.payload as Record<string, unknown>;
    assertEquals(notifPayload.notification_type, "expiring_soon");
    assertEquals(notifPayload.compliance_task_id, "task-1");
  } finally { restore(); }
});

Deno.test("pipeline — assigns contractor + auto-requests for critical priority", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "eicr", display_name: "EICR", default_lead_time_days: 90, default_frequency_months: 60 }];
    const doc = {
      id: "d2", property_id: "p2", document_type: "eicr", expiry_date: "2025-06-18", // 3 days → critical
      org_id: "org-1",
      property: { address_line_1: "5 Low Rd" },
    };
    const contractor = { id: "con-1", company_name: "Spark Ltd", email: "spark@example.com" };
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: null, error: null };
      if (call.table === "compliance_contractors") return { data: contractor, error: null };
      if (call.table === "compliance_tasks" && call.op === "insert") return { data: { id: "task-2" }, error: null };
      if (call.table === "compliance_notifications") return { data: null, error: null };
      if (call.table === "compliance_tasks" && call.op === "update") return { data: null, error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 1);
    assertEquals(result.contractors_assigned, 1);
    assertEquals(result.requests_sent, 1);

    const taskInsert = calls.find((c) => c.table === "compliance_tasks" && c.op === "insert")!;
    const payload = taskInsert.payload as Record<string, unknown>;
    assertEquals(payload.status, "contractor_assigned");
    assertEquals(payload.contractor_id, "con-1");

    // The subsequent update should set status to contractor_requested.
    const updateCall = calls.find((c) => c.table === "compliance_tasks" && c.op === "update");
    assert(updateCall);
    assertEquals((updateCall!.payload as { status: string }).status, "contractor_requested");
  } finally { restore(); }
});

Deno.test("pipeline — skips doc entirely when an open task already exists", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "gas_safety", display_name: "Gas Safety", default_lead_time_days: 30, default_frequency_months: 12 }];
    const doc = {
      id: "d1", property_id: "p1", document_type: "gas_safety", expiry_date: "2025-06-20",
      org_id: "org-1", property: { address_line_1: "10 High St" },
    };
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      // Existing open task found — skip this doc.
      if (call.table === "compliance_tasks" && call.op === "select" && call.terminal === "maybeSingle") {
        return { data: { id: "existing-task" }, error: null };
      }
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 0);
    // Contractor lookup should NOT have happened.
    assertEquals(calls.some((c) => c.table === "compliance_contractors"), false);
  } finally { restore(); }
});

Deno.test("pipeline — treats unique_violation (23505) on task insert as benign", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "gas_safety", display_name: "Gas Safety", default_lead_time_days: 30, default_frequency_months: 12 }];
    const doc = {
      id: "d1", property_id: "p1", document_type: "gas_safety", expiry_date: "2025-06-20",
      org_id: "org-1", property: { address_line_1: "10 High St" },
    };
    const { client } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      if (call.table === "compliance_tasks" && call.op === "select" && call.terminal === "maybeSingle") return { data: null, error: null };
      if (call.table === "compliance_contractors") return { data: null, error: null };
      if (call.table === "compliance_tasks" && call.op === "insert") return { data: null, error: { code: "23505", message: "unique violation" } };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    // Should NOT throw.
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 0);
  } finally { restore(); }
});

Deno.test("pipeline — recomputes priority on existing open tasks whose bucket has changed", async () => {
  const restore = quietConsole();
  try {
    const openTasks = [
      { id: "t1", due_date: "2025-06-18", priority: "low" }, // 3 days → should become critical
      { id: "t2", due_date: "2025-07-10", priority: "high" }, // 25 days → should stay high
      { id: "t3", due_date: "2025-08-20", priority: "critical" }, // 66 days → should become low
    ];
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: [], error: null };
      if (call.table === "compliance_documents_v2") return { data: [], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: openTasks, error: null };
      if (call.table === "compliance_tasks" && call.op === "update") return { data: null, error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.priorities_updated, 2); // t1 and t3

    const updates = calls.filter((c) => c.table === "compliance_tasks" && c.op === "update");
    assertEquals(updates.length, 2);
    // t1 should be updated to critical, t3 to low
    const t1Update = updates.find((u) => u.filters.id === "t1")!;
    const t3Update = updates.find((u) => u.filters.id === "t3")!;
    assertEquals((t1Update.payload as { priority: string }).priority, "critical");
    assertEquals((t3Update.payload as { priority: string }).priority, "low");
  } finally { restore(); }
});

Deno.test("pipeline — skips docs with null expiry_date defensively", async () => {
  const restore = quietConsole();
  try {
    const templates = [{ document_type: "gas_safety", display_name: "Gas Safety", default_lead_time_days: 30, default_frequency_months: 12 }];
    const doc = { id: "d1", property_id: "p1", document_type: "gas_safety", expiry_date: null, org_id: "org-1", property: null };
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [doc], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    const result = await runAutoCompliancePipeline(client, cronAuth, NOW);
    assertEquals(result.tasks_created, 0);
    assertEquals(calls.some((c) => c.table === "compliance_tasks" && c.op === "insert"), false);
  } finally { restore(); }
});

Deno.test("pipeline — uses maxLeadDays of max(all template lead times, 90) as the window", async () => {
  const restore = quietConsole();
  try {
    // Template has lead_time_days = 120 → window should be 120 days, not 90.
    const templates = [
      { document_type: "type_a", display_name: "A", default_lead_time_days: 120, default_frequency_months: null },
    ];
    const { client, calls } = makePipelineSupabase((call) => {
      if (call.table === "compliance_templates") return { data: templates, error: null };
      if (call.table === "compliance_documents_v2") return { data: [], error: null };
      if (call.table === "compliance_tasks" && call.op === "select") return { data: [], error: null };
      return { data: null, error: null };
    });
    await runAutoCompliancePipeline(client, cronAuth, NOW);
    const docsCall = calls.find((c) => c.table === "compliance_documents_v2");
    assert(docsCall);
    // NOW is 2025-06-15; + 120 days = 2025-10-13.
    assertEquals(docsCall!.filters.__lte_expiry_date, "2025-10-13");
  } finally { restore(); }
});
