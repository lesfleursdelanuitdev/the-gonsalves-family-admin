import { afterEach, describe, expect, it } from "vitest";
import { authCookieName, createAuthzApi, AuthorizationError } from "@ligneous/auth";

const prevCookieName = process.env.AUTH_COOKIE_NAME;

describe("@ligneous/auth package", () => {
  afterEach(() => {
    if (prevCookieName === undefined) {
      delete process.env.AUTH_COOKIE_NAME;
    } else {
      process.env.AUTH_COOKIE_NAME = prevCookieName;
    }
  });

  it("uses shared auth cookie env override", () => {
    process.env.AUTH_COOKIE_NAME = "shared_cookie";
    expect(authCookieName()).toBe("shared_cookie");
  });

  it("throws AuthorizationError when requirePermission denies", async () => {
    const authz = createAuthzApi(async () => false);
    await expect(
      authz.requirePermission({
        userId: "u1",
        entity: "role",
        action: "read",
        scope: "tree",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
