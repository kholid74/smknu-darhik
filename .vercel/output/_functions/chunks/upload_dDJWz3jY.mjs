import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro } from "./server_C1dVeAgT.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
import { n as uploadToR2 } from "./r2_DcnPelVm.mjs";
//#region src/pages/api/upload.astro
var upload_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Upload,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Upload = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Upload;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return new Response("Unauthorized", { status: 401 });
	if (!await verifyToken(token)) return new Response("Unauthorized", { status: 401 });
	if (Astro.request.method === "POST") try {
		const formData = await Astro.request.formData();
		const file = formData.get("file");
		if (!file || file.size === 0) return new Response(JSON.stringify({ error: "No file" }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
		if (file.size > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: "Max 10MB" }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
		const url = await uploadToR2(file, formData.get("folder")?.toString() || "uploads");
		return new Response(JSON.stringify({ url }), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/upload.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/upload.astro";
var $$url = "/api/upload";
//#endregion
//#region \0virtual:astro:page:src/pages/api/upload@_@astro
var page = () => upload_exports;
//#endregion
export { page };
