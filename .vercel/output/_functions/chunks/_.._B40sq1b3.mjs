import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro } from "./server_C1dVeAgT.mjs";
import { t as getFileFromR2 } from "./r2_DcnPelVm.mjs";
//#region src/pages/api/image/[...key].astro
var ____key__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Component,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Component = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Component;
	const key = Astro.params.key || "";
	const result = await getFileFromR2(key);
	if (!result) return new Response(JSON.stringify({
		error: "Not found",
		key
	}), {
		status: 404,
		headers: { "Content-Type": "application/json" }
	});
	return new Response(result.bytes, {
		status: 200,
		headers: {
			"Content-Type": result.contentType,
			"Cache-Control": "public, max-age=31536000, immutable"
		}
	});
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/image/[...key].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/image/[...key].astro";
var $$url = "/api/image/[...key]";
//#endregion
//#region \0virtual:astro:page:src/pages/api/image/[...key]@_@astro
var page = () => ____key__exports;
//#endregion
export { page };
