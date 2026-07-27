import { t as db } from "./prisma_CgM_1iz_.mjs";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
//#region src/lib/auth.ts
var SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "smkdh-dev-secret-change-in-production");
async function verifyPassword(pw, hash) {
	return bcrypt.compare(pw, hash);
}
async function signToken(userId, role) {
	return new SignJWT({
		sub: userId,
		role
	}).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h").sign(SECRET);
}
async function verifyToken(token) {
	try {
		const { payload } = await jwtVerify(token, SECRET);
		return payload;
	} catch {
		return null;
	}
}
async function login(username, password) {
	const admin = await db.admin.findUnique({ where: { username } });
	if (!admin) return null;
	if (!await verifyPassword(password, admin.password)) return null;
	return signToken(admin.id, admin.role);
}
//#endregion
export { verifyToken as n, login as t };
