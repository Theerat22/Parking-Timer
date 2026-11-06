import { test } from "node:test";
import assert from "node:assert/strict";
import { trustedOrigins, originDecision } from "../lib/origins";
test("local app origin remains supported", () =>
  assert.equal(
    originDecision("http://localhost:3000", {
      APP_ORIGIN: "http://localhost:3000/",
    }),
    "allowed",
  ));
test("Vercel project domain works even if APP_ORIGIN still points to localhost", () =>
  assert.equal(
    originDecision("https://parking-timer-wheat.vercel.app", {
      APP_ORIGIN: "http://localhost:3000",
      VERCEL_PROJECT_PRODUCTION_URL: "parking-timer-wheat.vercel.app",
    }),
    "allowed",
  ));
test("Vercel deployment and branch domains are explicit allowed origins", () => {
  const env = {
    VERCEL_URL: "parking-abc-team.vercel.app",
    VERCEL_BRANCH_URL: "parking-git-main-team.vercel.app",
  };
  assert.equal(
    originDecision("https://parking-abc-team.vercel.app", env),
    "allowed",
  );
  assert.equal(
    originDecision("https://parking-git-main-team.vercel.app", env),
    "allowed",
  );
});
test("unrelated domains and lookalikes remain rejected", () => {
  const env = {
    VERCEL_PROJECT_PRODUCTION_URL: "parking-timer-wheat.vercel.app",
  };
  for (const value of [
    "https://evil.example",
    "https://other.vercel.app",
    "https://parking-timer-wheat.vercel.app.evil.example",
    "null",
    null,
  ])
    assert.equal(originDecision(value, env), "rejected");
});
test("missing configuration is distinct from denied origin", () => {
  assert.equal(originDecision("https://example.com", {}), "unconfigured");
  assert.deepEqual(trustedOrigins({ APP_ORIGIN: "not a url" }), []);
});
test("host and forwarded request headers cannot add trusted domains", () =>
  assert.equal(
    originDecision("https://evil.example", {
      APP_ORIGIN: "https://parking.example",
      HOST: "evil.example",
      "X-Forwarded-Host": "evil.example",
    }),
    "rejected",
  ));
