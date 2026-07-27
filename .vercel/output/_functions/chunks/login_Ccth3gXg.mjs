import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, d as renderTemplate, g as renderHead } from "./server_C1dVeAgT.mjs";
import { n as verifyToken, t as login } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/login.astro
var login_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Login,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Login = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Login;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (token && await verifyToken(token)) return Astro.redirect("/admin");
	let error = "";
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const token = await login(data.get("username")?.toString() || "", data.get("password")?.toString() || "");
		if (token) {
			Astro.cookies.set("smkdh_token", token, {
				httpOnly: true,
				path: "/",
				maxAge: 86400,
				sameSite: "lax"
			});
			return Astro.redirect("/admin");
		}
		error = "Username atau password salah";
	}
	return renderTemplate`<html lang="id" data-astro-cid-xeimgta2><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login — Admin SMKS NU DARUL HIKAM</title><link rel="icon" type="image/png" href="/assets/logo.png"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">${renderHead($$result)}</head><body data-astro-cid-xeimgta2><div class="login-card" data-astro-cid-xeimgta2><div style="text-align:center;margin-bottom:20px" data-astro-cid-xeimgta2><img src="/assets/logo.png" alt="Logo" style="width:60px;height:60px;margin-bottom:12px" data-astro-cid-xeimgta2></div><h1 data-astro-cid-xeimgta2>Panel Admin</h1><p class="sub" data-astro-cid-xeimgta2>SMKS NU Darul Hikam</p>${error && renderTemplate`<div class="error" data-astro-cid-xeimgta2>${error}</div>`}<form method="POST" data-astro-cid-xeimgta2><label for="username" data-astro-cid-xeimgta2>Username</label><input type="text" id="username" name="username" required autofocus data-astro-cid-xeimgta2><label for="password" data-astro-cid-xeimgta2>Password</label><input type="password" id="password" name="password" required data-astro-cid-xeimgta2><button type="submit" data-astro-cid-xeimgta2>Masuk</button></form><div style="text-align:center;margin-top:20px" data-astro-cid-xeimgta2><a href="/" style="font-size:13px;color:#1B7A3D;text-decoration:none;font-weight:600" data-astro-cid-xeimgta2>&larr; Kembali ke website</a></div></div></body></html>`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/login.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/login.astro";
var $$url = "/admin/login";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/login@_@astro
var page = () => login_exports;
//#endregion
export { page };
