import { Router } from "express";
import { User, Tenant } from "./models.js";
import { redis } from "./redis.js";
import { config } from "./config.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  validateRegister,
  validateLogin,
  DUMMY_HASH,
} from "./auth.js";

export const authRouter = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const fail = (res, status, error, errors) =>
  res.status(status).json({ error, ...(errors ? { errors } : {}) });

// Max `max` hits per `windowSec` for a key (Redis-backed, works across API instances).
async function allow(key, max, windowSec) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= max;
}
const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});

authRouter.post(
  "/register",
  wrap(async (req, res) => {
    if (!config.allowSignup)
      return fail(res, 403, "Sign-up is disabled on this server");
    if (!(await allow(`reg:${req.ip}`, 20, 3600)))
      return fail(
        res,
        429,
        "Too many sign-ups from this address. Try again later.",
      );
    const v = validateRegister(req.body);
    if (!v.valid) return fail(res, 400, Object.values(v.errors)[0], v.errors);
    const { name, email, password, workspace } = v.clean;
    if (await User.exists({ email }))
      return fail(res, 409, "An account with this email already exists", {
        email: "Email already registered",
      });

    const tenant = await Tenant.create({ name: workspace });
    try {
      const user = await User.create({
        tenantId: tenant._id,
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "owner",
      });
      const token = signToken({
        sub: String(user._id),
        tid: String(tenant._id),
      });
      res
        .status(201)
        .json({ token, user: publicUser(user), workspace: tenant.name });
    } catch (e) {
      await Tenant.deleteOne({ _id: tenant._id }); // never leave an orphan workspace behind
      if (e.code === 11000)
        return fail(res, 409, "An account with this email already exists", {
          email: "Email already registered",
        });
      throw e;
    }
  }),
);

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const v = validateLogin(req.body);
    if (!v.valid) return fail(res, 400, Object.values(v.errors)[0], v.errors);
    const { email, password } = v.clean;
    if (!(await allow(`login:${req.ip}:${email}`, 10, 900)))
      return fail(
        res,
        429,
        "Too many failed attempts. Wait 15 minutes and try again.",
      );
    const user = await User.findOne({ email });
    const ok = await verifyPassword(
      password,
      user ? user.passwordHash : DUMMY_HASH,
    ); // same work either way
    if (!user || !ok) return fail(res, 401, "Invalid email or password");
    await redis.del(`login:${req.ip}:${email}`);
    const tenant = await Tenant.findById(user.tenantId);
    res.json({
      token: signToken({ sub: String(user._id), tid: String(user.tenantId) }),
      user: publicUser(user),
      workspace: tenant?.name,
    });
  }),
);

// Real logout: the token's id goes on a Redis deny-list until it would have expired anyway.
authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    const h = req.header("authorization") || "";
    const p = h.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
    if (p)
      await redis.set(
        `revoked:${p.jti}`,
        "1",
        "EX",
        Math.max(1, p.exp - Math.floor(Date.now() / 1000)),
      );
    res.json({ ok: true });
  }),
);
