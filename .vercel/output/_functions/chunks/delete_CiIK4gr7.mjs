import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro } from "./server_C1dVeAgT.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/fasilitas/delete.astro
var delete_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Delete,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Delete = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Delete;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return Astro.redirect("/admin/login");
	if (!await verifyToken(token)) return Astro.redirect("/admin/login");
	if (Astro.request.method === "POST") {
		const id = (await Astro.request.formData()).get("id")?.toString();
		if (id) await db.facility.delete({ where: { id } }).catch(() => {});
	}
	return Astro.redirect("/admin/fasilitas");
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/fasilitas/delete.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/fasilitas/delete.astro";
var $$url = "/admin/fasilitas/delete";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/fasilitas/delete@_@astro
var page = () => delete_exports;
//#endregion
export { page };
