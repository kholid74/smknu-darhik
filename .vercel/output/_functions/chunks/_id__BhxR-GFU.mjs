import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/download/[id].astro
var _id__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Id,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Id = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Id;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return Astro.redirect("/admin/login");
	const session = await verifyToken(token);
	if (!session) return Astro.redirect("/admin/login");
	const { id } = Astro.params;
	const isEdit = id && id !== "new";
	const item = isEdit ? await db.download.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/download?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			title: data.get("title")?.toString() || "",
			fileUrl: data.get("fileUrl")?.toString() || "",
			category: data.get("category")?.toString() || null
		};
		if (isEdit) await db.download.update({
			where: { id },
			data: record
		});
		else await db.download.create({ data: record });
		return Astro.redirect("/admin/download?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Download" : "Tambah Download",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul *</label><input type="text" name="title"${addAttribute(item?.title || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL File *</label><input type="url" name="fileUrl"${addAttribute(item?.fileUrl || "", "value")} placeholder="https://..." required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kategori</label><select name="category"><option value="">-</option><option value="Formulir"${addAttribute(item?.category === "Formulir" || void 0, "selected")}>Formulir</option><option value="Brosur"${addAttribute(item?.category === "Brosur" || void 0, "selected")}>Brosur</option><option value="Akademik"${addAttribute(item?.category === "Akademik" || void 0, "selected")}>Akademik</option></select></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/download" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/download/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/download/[id].astro";
var $$url = "/admin/download/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/download/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
