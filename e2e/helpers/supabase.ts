import type { Page, Route } from '@playwright/test';

type JsonBody = Record<string, unknown> | Array<unknown>;

function matchRpcRoute(rpcName: string) {
  return new RegExp(`/rest/v1/rpc/${rpcName}(\\?.*)?$`);
}

export async function mockSupabaseRpc(page: Page, rpcName: string, body: JsonBody, status = 200) {
  await page.route(matchRpcRoute(rpcName), async (route: Route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}
