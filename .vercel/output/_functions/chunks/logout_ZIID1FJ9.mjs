import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, d as renderTemplate, h as maybeRenderHead } from "./server_C1dVeAgT.mjs";
//#region src/pages/admin/logout.astro
var logout_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Logout,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Logout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Logout;
	if (Astro.request.method === "GET") {
		Astro.cookies.delete("smkdh_token", { path: "/" });
		return Astro.redirect("/admin/login");
	}
	return renderTemplate`<html>${maybeRenderHead($$result)}<body><p>Logging out...</p></body></html>`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/logout.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/logout.astro";
var $$url = "/admin/logout";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/logout@_@astro
var page = () => logout_exports;
//#endregion
export { page };
