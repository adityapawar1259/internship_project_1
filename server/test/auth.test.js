import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  validateRegister,
  validateLogin,
  validatePassword,
} from "../src/auth.js";

test("password hashing: verifies right password, rejects wrong, salts differ", async () => {
  const a = await hashPassword("Secret123");
  const b = await hashPassword("Secret123");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("Secret123", a));
  assert.ok(!(await verifyPassword("secret123", a)));
  assert.ok(!(await verifyPassword("x", "garbage")));
});

test("jwt: round trip, tamper, wrong secret, expiry", () => {
  const secret = "s".repeat(32);
  const t = signToken({ sub: "u1", tid: "t1" }, { ttlSec: 60, secret });
  const p = verifyToken(t, { secret });
  assert.equal(p.sub, "u1");
  assert.ok(p.jti);
  assert.equal(verifyToken(t, { secret: "other-secret" }), null);
  const [h, body, sig] = t.split(".");
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(body, "base64url")),
      sub: "admin",
    }),
  ).toString("base64url");
  assert.equal(verifyToken(`${h}.${forged}.${sig}`, { secret }), null);
  assert.equal(
    verifyToken(signToken({ sub: "u1" }, { ttlSec: -5, secret }), { secret }),
    null,
  );
  assert.equal(verifyToken("not.a.token", { secret }), null);
  assert.equal(verifyToken("", { secret }), null);
});

test("validation: register and login rules", () => {
  const ok = validateRegister({
    name: " Adity ",
    email: " Adity@Example.COM ",
    password: "abc12345",
  });
  assert.ok(ok.valid);
  assert.equal(ok.clean.email, "adity@example.com");
  assert.equal(ok.clean.name, "Adity");
  assert.equal(ok.clean.workspace, "Adity's workspace");
  const bad = validateRegister({ name: "A", email: "nope", password: "short" });
  assert.deepEqual(Object.keys(bad.errors).sort(), [
    "email",
    "name",
    "password",
  ]);
  assert.ok(validatePassword("onlyletters"));
  assert.ok(validatePassword("12345678"));
  assert.equal(validatePassword("abcd1234"), null);
  assert.ok(!validateLogin({ email: "a@b.co", password: "" }).valid);
  assert.ok(validateLogin({ email: "a@b.co", password: "x" }).valid);
});
